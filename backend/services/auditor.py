import asyncio
import httpx
from bs4 import BeautifulSoup
import os
import re
import time
import json
from urllib.parse import urljoin, urlparse, unquote
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List, Optional
from services.brands import resolve_known_brand_website

load_dotenv()

class GeminiAuditResult(BaseModel):
    score: int
    ai_summary: str
    opportunities: list[str]
    sales_pitch_whatsapp: str
    sales_pitch_email: str


DIRECTORY_BLACKLIST = {
    "duckduckgo.com", "google.com", "google.com.tr", "bing.com", "yahoo.com", "yandex.com", "yandex.com.tr",
    "facebook.com", "fb.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
    "wa.me", "whatsapp.com", "t.me", "pinterest.com", "foursquare.com", "swarmapp.com", "tripadvisor.com",
    "tripadvisor.com.tr", "yelp.com", "yelp.com.tr", "sikayetvar.com", "eksisozluk.com", "wikipedia.org",
    "bulurum.com", "yellowpages.com.tr", "yemeksepeti.com", "getir.com", "trendyol.com", "hepsiburada.com",
    "n11.com", "sahibinden.com", "hepsiemlak.com", "emlakjet.com", "kariyer.net", "armut.com",
    "doktortakvimi.com", "eniyihekim.com", "findglocal.com", "cylex.com.tr", "neredekal.com", "etstur.com",
    "obilet.com", "zomato.com", "harita.gov.tr", "rehber.com", "firmarehberi.com", "turkcebilgi.com"
}


def _decode_cfemail(cfemail_hex: str) -> Optional[str]:
    try:
        r = int(cfemail_hex[:2], 16)
        email = "".join([chr(int(cfemail_hex[i:i+2], 16) ^ r) for i in range(2, len(cfemail_hex), 2)])
        if "@" in email and "." in email.split("@")[-1]:
            return email.lower().strip()
    except Exception:
        pass
    return None


def _normalize_tr_phone(raw: str) -> Optional[str]:
    digits = re.sub(r"\D", "", raw)
    # 444 XX XX (7 haneli çağrı merkezi)
    if len(digits) == 7 and digits.startswith("444"):
        return f"444 {digits[3:5]} {digits[5:7]}"
    # 90 ile başlayan 12 haneli numara
    if len(digits) == 12 and digits.startswith("90"):
        digits = "0" + digits[2:]
    elif len(digits) == 10 and digits[0] in ("2", "3", "4", "5", "8"):
        digits = "0" + digits
    if len(digits) == 11 and digits.startswith("0") and digits[1] in ("2", "3", "4", "5", "8"):
        # Geçersiz tarih/saat/kimlik benzeri dizileri ele
        if digits.startswith("0202") or digits[1:4] in ("000", "111", "999"):
            return None
        return f"{digits[0:4]} {digits[4:7]} {digits[7:9]} {digits[9:11]}"
    return None


def _detect_cms_platform(html_lower: str, soup: BeautifulSoup) -> str:
    generator = ""
    gen_meta = soup.find("meta", attrs={"name": re.compile(r"^generator$", re.I)})
    if gen_meta and gen_meta.get("content"):
        generator = str(gen_meta.get("content")).lower()

    if "ticimax" in html_lower or "ticimax" in generator:
        return "Ticimax E-Ticaret"
    if "ideasoft" in html_lower or "ideasoft" in generator:
        return "IdeaSoft E-Ticaret"
    if "ikas.com" in html_lower or "cdn.myikas.com" in html_lower:
        return "İkas E-Ticaret"
    if "tsoft" in html_lower or "t-soft" in html_lower:
        return "T-Soft E-Ticaret"
    if "cdn.shopify.com" in html_lower or "shopify" in generator:
        return "Shopify"
    if "wix.com" in html_lower or "wixstatic.com" in html_lower or "wix" in generator:
        return "Wix"
    if "wp-content" in html_lower or "wp-includes" in html_lower or "wordpress" in generator:
        if "woocommerce" in html_lower:
            return "WordPress + WooCommerce"
        return "WordPress"
    if "opencart" in html_lower or "route=common/home" in html_lower:
        return "OpenCart"
    if "prestashop" in html_lower or "prestashop" in generator:
        return "PrestaShop"
    if "joomla" in html_lower or "joomla" in generator:
        return "Joomla"
    if "_next/static" in html_lower or "__next_data__" in html_lower:
        return "Next.js / React"
    if "__nuxt" in html_lower or "_nuxt/" in html_lower:
        return "Nuxt / Vue.js"
    if "bootstrap" in html_lower:
        return "Bootstrap / Özel Web"
    return "Özel Web Yazılımı (HTML/CSS)"


def _extract_contacts_and_socials_from_doc(
    soup: BeautifulSoup,
    html_text: str,
    emails: set[str],
    phones: set[str],
    socials: dict[str, str]
) -> Optional[str]:
    scraped_whatsapp: Optional[str] = None

    # 1. Cloudflare e-posta koruması çözümü (data-cfemail)
    for cf_el in soup.find_all(attrs={"data-cfemail": True}):
        decoded = _decode_cfemail(str(cf_el.get("data-cfemail", "")))
        if decoded:
            emails.add(decoded)

    # 2. <a href="..."> bağlantılarından e-posta, telefon ve sosyal medya kazıma
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        href_lower = href.lower()

        if href_lower.startswith("mailto:"):
            mail = unquote(href[7:].split("?")[0]).strip().lower()
            if "@" in mail and "." in mail.split("@")[-1]:
                emails.add(mail)
        elif "/cdn-cgi/l/email-protection#" in href_lower:
            hex_part = href.split("#")[-1].strip()
            decoded = _decode_cfemail(hex_part)
            if decoded:
                emails.add(decoded)
        elif href_lower.startswith("tel:"):
            tel_raw = unquote(href[4:].split("?")[0]).strip()
            norm_tel = _normalize_tr_phone(tel_raw)
            if norm_tel:
                phones.add(norm_tel)
        elif "wa.me/" in href_lower or "api.whatsapp.com" in href_lower or "whatsapp://send" in href_lower:
            if "whatsapp" not in socials:
                socials["whatsapp"] = href
            wa_digits = re.findall(r"(?:90|0)?5\d{9}", re.sub(r"\D", "", href))
            if wa_digits:
                norm_wa = _normalize_tr_phone(wa_digits[0])
                if norm_wa:
                    phones.add(norm_wa)
                    scraped_whatsapp = norm_wa
        elif "instagram.com/" in href_lower and not any(x in href_lower for x in ["/p/", "/reel/", "/explore/"]):
            if "instagram" not in socials:
                socials["instagram"] = href
        elif ("facebook.com/" in href_lower or "fb.com/" in href_lower) and "sharer" not in href_lower:
            if "facebook" not in socials:
                socials["facebook"] = href
        elif "linkedin.com/" in href_lower and ("/company/" in href_lower or "/in/" in href_lower):
            if "linkedin" not in socials:
                socials["linkedin"] = href
        elif "youtube.com/" in href_lower and ("/@" in href_lower or "/channel/" in href_lower or "/c/" in href_lower or "/user/" in href_lower):
            if "youtube" not in socials:
                socials["youtube"] = href
        elif ("twitter.com/" in href_lower or "x.com/" in href_lower) and "intent/" not in href_lower:
            if "twitter" not in socials:
                socials["twitter"] = href
        elif "tiktok.com/@" in href_lower:
            if "tiktok" not in socials:
                socials["tiktok"] = href

    # 3. Görünür metin üzerinden E-posta Regex Kazıma
    visible_text = " ".join(soup.stripped_strings)
    raw_emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", visible_text[:60000])
    blocked_ext = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff", ".ttf", ".ico")
    for mail in raw_emails:
        mail_clean = mail.lower().strip()
        if not mail_clean.endswith(blocked_ext) and not any(
            x in mail_clean for x in ["example.com", "sentry.io", "wixpress.com", "schema.org", "domain.com", "email.com"]
        ):
            emails.add(mail_clean)

    # 4. Görünür metin üzerinden Türkiye Telefon Numarası Regex Kazıma
    phone_patterns = [
        r"(?:\+90|0)\s*\(?[23458]\d{2}\)?[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}",
        r"\b444[\s.\-]?\d{2}[\s.\-]?\d{2}\b",
    ]
    for pat in phone_patterns:
        for match in re.findall(pat, visible_text[:50000]):
            norm_p = _normalize_tr_phone(match)
            if norm_p:
                phones.add(norm_p)

    return scraped_whatsapp


def _find_contact_subpage_urls(soup: BeautifulSoup, base_url: str) -> list[str]:
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower().replace("www.", "")
    contact_keywords = (
        "iletisim", "iletişim", "contact", "bize-ulasin", "bize_ulasin",
        "ulasim", "ulaşım", "hakkimizda", "hakkımızda", "kurumsal", "about"
    )
    candidates: list[str] = []
    seen = {base_url.rstrip("/")}

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        full_url = urljoin(base_url, href).split("#")[0].rstrip("/")
        parsed = urlparse(full_url)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc.lower().replace("www.", "") != base_domain:
            continue
        if full_url in seen:
            continue

        path_and_text = (parsed.path + " " + a_tag.get_text(" ", strip=True)).lower()
        if any(kw in path_and_text for kw in contact_keywords):
            seen.add(full_url)
            candidates.append(full_url)
            if len(candidates) >= 2:
                break

    return candidates


def _slugify_turkish_name(name: str) -> list[str]:
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    clean = name.translate(tr_map).lower()
    clean = re.sub(r"[^a-z0-9\s]", " ", clean)
    stop_words = {"ve", "ile", "ltd", "sti", "as", "san", "tic", "subesi", "sube", "merkez", "istanbul", "ankara", "izmir"}
    words = [w for w in clean.split() if len(w) > 1 and w not in stop_words]
    if not words:
        return []

    slugs = []
    # Tam birleşik isim (örn: modadisklinigi)
    joined_all = "".join(words[:3])
    if 3 <= len(joined_all) <= 26:
        slugs.append(joined_all)
    # İlk iki kelime (örn: modadis)
    if len(words) >= 2:
        joined_two = "".join(words[:2])
        if 3 <= len(joined_two) <= 22 and joined_two not in slugs:
            slugs.append(joined_two)
    # Tek anlamlı marka kelimesi (örn: a101, espressolab)
    if len(words[0]) >= 4 and words[0] not in slugs:
        slugs.append(words[0])

    return slugs[:2]


async def _discover_website_and_socials(
    name: str,
    category: Optional[str],
    headers: dict[str, str]
) -> tuple[Optional[str], dict[str, str]]:
    """
    Haritada web sitesi kaydı bulunmayan işletmeler için:
    1) Bilinen kurumsal zincir sözlüğünü kontrol eder.
    2) DuckDuckGo HTML araması üzerinden resmi web sitesini ve sosyal medya profillerini keşfeder.
    3) Türkçe alan adı (.com.tr / .com) adaylarını hızlıca yoklar.
    """
    discovered_socials: dict[str, str] = {}

    # 1. Bilinen Kurumsal Zincir kontrolü
    brand_url = resolve_known_brand_website(name)
    if brand_url:
        return brand_url, discovered_socials

    slugs = _slugify_turkish_name(name)
    primary_keyword = slugs[0][:6] if slugs else ""

    # 2. DuckDuckGo HTML Araması ile Canlı Web & Sosyal Medya Keşfi
    try:
        query = f'"{name}" {category or ""}'.strip()
        async with httpx.AsyncClient(timeout=4.5, headers=headers, follow_redirects=True) as client:
            resp = await client.get("https://html.duckduckgo.com/html/", params={"q": query})
            if resp.status_code == 200 and resp.text:
                soup = BeautifulSoup(resp.text, "html.parser")
                for a_tag in soup.select("a.result__a, a.result__url"):
                    raw_href = a_tag.get("href", "")
                    if "uddg=" in raw_href:
                        raw_href = unquote(raw_href.split("uddg=")[-1].split("&")[0])
                    if not raw_href.startswith("http"):
                        continue

                    parsed = urlparse(raw_href)
                    domain = parsed.netloc.lower().replace("www.", "")
                    if not domain:
                        continue

                    # Sosyal medya profili yakalama
                    if "instagram.com" in domain and "instagram" not in discovered_socials:
                        if not any(x in raw_href.lower() for x in ["/p/", "/reel/", "/explore/"]):
                            discovered_socials["instagram"] = raw_href
                        continue
                    if "facebook.com" in domain and "facebook" not in discovered_socials:
                        discovered_socials["facebook"] = raw_href
                        continue
                    if "linkedin.com" in domain and "linkedin" not in discovered_socials:
                        discovered_socials["linkedin"] = raw_href
                        continue

                    # Rehber/dizin sitelerini atla
                    if any( domain == blk or domain.endswith("." + blk) for blk in DIRECTORY_BLACKLIST ):
                        continue

                    # Domain işletme adının anahtar kelimesini içeriyorsa doğrudan resmi sitedir
                    domain_root = domain.split(".")[0].replace("-", "")
                    if primary_keyword and len(primary_keyword) >= 3 and primary_keyword in domain_root:
                        return f"{parsed.scheme}://{parsed.netloc}", discovered_socials
    except Exception:
        pass

    # 3. Akıllı Alan Adı (.com.tr / .com) Doğrulaması
    if slugs:
        candidate_urls = []
        for s in slugs[:2]:
            candidate_urls.append(f"https://www.{s}.com.tr")
            candidate_urls.append(f"https://www.{s}.com")

        async def _probe_url(u: str) -> Optional[str]:
            try:
                async with httpx.AsyncClient(timeout=3.0, headers=headers, follow_redirects=True, verify=False) as c:
                    r = await c.get(u)
                    if r.status_code < 400 and len(r.text) > 400:
                        text_low = r.text[:8000].lower()
                        # Park edilmiş domain sayfalarını ele
                        if any(park in text_low for park in ["domain for sale", "satılık domain", "sedoparking", "godaddy", "bu alan adı"]):
                            return None
                        return str(r.url).rstrip("/")
            except Exception:
                return None
            return None

        probe_results = await asyncio.gather(*[_probe_url(u) for u in candidate_urls])
        for res_url in probe_results:
            if res_url:
                return res_url, discovered_socials

    return None, discovered_socials


def _build_smart_fallback_analysis(name: str, category: str | None, result: dict) -> None:
    cat_label = category or "yerel işletme"
    if not result["has_website"]:
        result["score"] = 92
        result["ai_summary"] = (
            f"{name} ({cat_label}) için harita veritabanında ve yapılan derin web/alan adı taramasında aktif bir "
            f"kurumsal web sitesine rastlanmamıştır. Bölgesel aramalarda potansiyel müşterilerin işletmeye doğrudan "
            f"ulaşabilmesi için modern, mobil uyumlu bir web sitesi ve Google İşletme Profili (Yerel SEO) "
            f"optimizasyonu en yüksek öncelikli satış fırsatıdır."
        )
        result["opportunities"] = [
            "Kurumsal Web Sitesi Kurulumu",
            "Google İşletme Profili & Yerel SEO",
            "Online Randevu / WhatsApp İletişim Entegrasyonu",
            "Sosyal Medya & Dijital Kimlik Yönetimi"
        ]
        result["sales_pitch_whatsapp"] = (
            f"Merhaba {name} yetkilisi, bölgenizdeki {cat_label} sektörüne yönelik dijital görünürlük incelememizde "
            f"işletmenizin aktif bir web sitesinin bulunmadığını fark ettik. Google aramalarında bölgenizdeki "
            f"müşterilerin size doğrudan ulaşmasını sağlayacak mobil uyumlu kurumsal web sitesi ve harita SEO "
            f"çözümlerimiz hakkında 2 dakikalık bir ön sunum paylaşmak isteriz. Müsaitliğiniz nasıl olur?"
        )
        result["sales_pitch_email"] = (
            f"Konu: {name} - Dijital Görünürlük ve Yeni Müşteri Kazanımı Raporu\n\n"
            f"Sayın {name} Yetkilisi,\n\n"
            f"Bölgenizde faaliyet gösteren {cat_label} işletmelerinin dijital varlıkları üzerine gerçekleştirdiğimiz "
            f"teknik analizde, işletmenize ait aktif bir web sitesi bulunmadığını tespit ettik.\n\n"
            f"Günümüzde yerel müşterilerin %80'inden fazlası hizmet almadan önce Google üzerinden arama yapmaktadır. "
            f"İşletmenize özel hazırlayabileceğimiz hızlı, mobil uyumlu kurumsal web sitesi ve Google Haritalar SEO "
            f"çalışması ile bölgenizdeki potansiyel müşterileri doğrudan işletmenize yönlendirebiliriz.\n\n"
            f"Ücretsiz örnek tasarım ve yol haritasını paylaşmak adına uygun olduğunuzda kısa bir görüşme planlamak isteriz.\n\n"
            f"İyi çalışmalar dileriz."
        )
        return

    # Kurumsal zincir şubesi kontrolü
    if result.get("is_corporate_chain"):
        result["score"] = 20
        result["ai_summary"] = (
            f"{name} ulusal/küresel ölçekli bir kurumsal zincir şubesidir ve merkezi web altyapısı "
            f"({result.get('discovered_website') or 'mevcut'}) aktif durumdadır. Bireysel web tasarım satışı yerine "
            f"bağımsız yerel işletmelere odaklanılması önerilir."
        )
        result["opportunities"] = [
            "Kurumsal Zincir (Merkezi Yönetim)",
            "Bölgesel Sponsorluk / İşbirliği"
        ]
        result["sales_pitch_whatsapp"] = (
            f"Merhaba {name} yetkilisi, bölgenizdeki şubeniz için yürüttüğümüz yerel tanıtım ve dijital işbirliği "
            f"projemiz hakkında ilgili departmanınızla bilgi paylaşmak isteriz."
        )
        result["sales_pitch_email"] = (
            f"Konu: {name} - Bölgesel Dijital İşbirliği Teklifi\n\n"
            f"Sayın {name} Yetkilisi,\n\n"
            f"Bölgesel dijital pazarlama ve yerel görünürlük projelerimiz kapsamında kurumsal iletişim "
            f"departmanınızla işbirliği olanaklarını değerlendirmek isteriz.\n\n"
            f"İyi çalışmalar dileriz."
        )
        return

    # Yerel işletmenin web sitesi mevcut: Teknik sinyalleri değerlendir
    deficiencies = []
    opps = []
    score = 28

    if not result["ssl_valid"]:
        deficiencies.append("SSL güvenlik sertifikası (HTTPS) bulunmuyor ve tarayıcılarda 'Güvenli Değil' uyarısı veriyor")
        opps.append("SSL Güvenlik Sertifikası & HTTPS Geçişi")
        score += 20

    if not result["mobile_ready"]:
        deficiencies.append("mobil cihaz uyumluluk (responsive viewport) etiketi eksik")
        opps.append("Mobil Uyumlu (Responsive) Web Yenileme")
        score += 20

    if not result["has_title"] or not result["has_meta_description"] or not result["has_h1"]:
        missing_seo = []
        if not result["has_title"]:
            missing_seo.append("sayfa başlığı (title)")
        if not result["has_meta_description"]:
            missing_seo.append("meta açıklama (description)")
        if not result["has_h1"]:
            missing_seo.append("H1 ana başlık etiketi")
        deficiencies.append(f"temel SEO etiketlerinde ({', '.join(missing_seo)}) eksiklikler mevcut")
        opps.append("Teknik SEO & Arama Motoru Optimizasyonu")
        score += 15

    if not result.get("has_schema"):
        opps.append("Schema.org (Yerel İşletme Yapısal Veri) Kurulumu")
        score += 6

    if not result["has_analytics"] and not result["has_pixel"]:
        deficiencies.append("Google Analytics veya Meta Pixel dönüşüm takip kodları kurulu değil")
        opps.append("Google Ads & Meta Pixel Dönüşüm Kurulumu")
        score += 12
    elif not result["has_pixel"]:
        opps.append("Sosyal Medya Yeniden Pazarlama (Meta Pixel) Kurulumu")
        score += 6

    if result.get("response_time_ms") and result["response_time_ms"] > 2000:
        deficiencies.append(f"sayfa yanıt süresi ({result['response_time_ms']} ms) ideal hız sınırının üzerinde")
        opps.append("Site Hızlandırma & Performans Optimizasyonu")
        score += 8

    if not opps:
        opps = ["İçerik & Yerel SEO Güncellemesi", "Google Ads Arama Ağı Reklam Yönetimi", "Dönüşüm Oranı Optimizasyonu (CRO)"]

    result["score"] = min(95, max(25, score))

    discovery_note = ""
    if result.get("website_source") == "auto_discovered" and result.get("discovered_website"):
        discovery_note = f"Harita kaydında yer almayan web sitesi ({result['discovered_website']}) derin tarama ile otomatik tespit edilmiştir. "

    cms_note = f"Altyapı: {result['cms_platform']}. " if result.get("cms_platform") else ""

    if deficiencies:
        def_text = "; ayrıca ".join(deficiencies)
        result["ai_summary"] = (
            f"{discovery_note}{cms_note}{name} web sitesi erişilebilir durumda ({result.get('response_time_ms', 0)} ms yanıt süresi), "
            f"ancak yapılan teknik röntgende {def_text}. Bu eksikliklerin giderilmesi işletmenin Google sıralamasını "
            f"ve müşteri dönüşüm oranını doğrudan artıracaktır."
        )
        main_issue = deficiencies[0]
    else:
        result["ai_summary"] = (
            f"{discovery_note}{cms_note}{name} işletmesinin web sitesi temel SSL, mobil uyumluluk ve SEO kriterlerini sağlamaktadır. "
            f"Bu aşamada işletmeye bölgesel Google Ads reklam yönetimi, sosyal medya içerik üretimi ve "
            f"dönüşüm odaklı büyüme paketleri sunulabilir."
        )
        main_issue = "bölgesel arama motoru rekabetinde üst sıralara çıkma potansiyeli"

    result["opportunities"] = opps
    result["sales_pitch_whatsapp"] = (
        f"Merhaba {name} yetkilisi, işletmenizin web sitesini ({result.get('cms_platform') or 'kurumsal web'}) teknik olarak inceledik. "
        f"Siteniz aktif ancak {main_issue} konusunda iyileştirme fırsatları tespit ettik. Küçük bir revizyonla Google aramalarından "
        f"gelen müşteri trafiğinizi artırabiliriz. Hazırladığımız kısa teknik raporu paylaşmamızı ister misiniz?"
    )
    result["sales_pitch_email"] = (
        f"Konu: {name} Web Sitesi Teknik Analiz ve İyileştirme Raporu\n\n"
        f"Sayın {name} Yetkilisi,\n\n"
        f"İşletmenize ait web sitesi üzerinde gerçekleştirdiğimiz derin teknik denetimde öne çıkan bulgular aşağıdadır:\n"
        f"- Web Altyapısı: {result.get('cms_platform') or 'Standart Web'}\n"
        f"- SSL Güvenlik Durumu: {'Geçerli (HTTPS)' if result['ssl_valid'] else 'Eksik (Güvenli Değil Uyarısı)'}\n"
        f"- Mobil Uyumluluk: {'Uyumlu' if result['mobile_ready'] else 'Eksik (Mobil Cihazlarda Görünüm Sorunu)'}\n"
        f"- SEO Meta & Başlık Yapısı: {'Tam' if (result['has_title'] and result['has_meta_description']) else 'Eksik Etiketler Mevcut'}\n"
        f"- Yapısal Veri (Schema.org): {'Mevcut' if result.get('has_schema') else 'Eksik'}\n"
        f"- Reklam ve Analitik Takibi: {'Kurulu' if (result['has_analytics'] or result['has_pixel']) else 'Kurulu Değil'}\n\n"
        f"Belirtilen noktaların optimize edilmesiyle sitenizin arama motoru performansını ve müşteri dönüşümlerini "
        f"hızla yükseltebiliriz. Detayları görüşmek üzere geri dönüşünüzü bekleriz.\n\n"
        f"İyi çalışmalar dileriz."
    )


async def run_audit(name: str, website: str | None, category: Optional[str] = None) -> dict:
    result = {
        "score": 0,
        "ssl_valid": False,
        "mobile_ready": False,
        "has_website": False,
        "discovered_website": None,
        "website_source": "osm" if (website and website.strip()) else None,
        "is_corporate_chain": False,
        "http_status": None,
        "response_time_ms": None,
        "has_title": False,
        "page_title": None,
        "has_meta_description": False,
        "meta_description": None,
        "has_h1": False,
        "h1_text": None,
        "has_og_tags": False,
        "has_schema": False,
        "has_favicon": False,
        "has_analytics": False,
        "has_pixel": False,
        "cms_platform": None,
        "crawled_pages": [],
        "scraped_emails": [],
        "scraped_phones": [],
        "scraped_whatsapp": None,
        "social_links": {},
        "ai_summary": "",
        "opportunities": [],
        "ai_engine_used": "smart_hybrid_ai",
        "recommended_package": None,
        "detected_pain_points": [],
        "value_propositions": [],
        "sales_pitch_whatsapp": "",
        "email_subject": "",
        "sales_pitch_email": "",
        "instagram_dm_pitch": "",
        "cold_call_script": ""
    }

    from services.pitch_generator import generate_personalized_pitch

    async def _attach_ai_pitches(res: dict) -> dict:
        if res.get("is_corporate_chain"):
            return res
        pitch_data = await generate_personalized_pitch(
            merchant_name=name,
            category=category,
            tone="kurumsal",
            focus_service="auto",
            audit_context=res,
        )
        res["ai_engine_used"] = pitch_data.get("engine_used", "smart_hybrid_ai")
        res["recommended_package"] = pitch_data.get("recommended_package")
        res["detected_pain_points"] = pitch_data.get("detected_pain_points", [])
        res["value_propositions"] = pitch_data.get("value_propositions", [])
        res["sales_pitch_whatsapp"] = pitch_data.get("whatsapp_pitch") or res.get("sales_pitch_whatsapp")
        res["email_subject"] = pitch_data.get("email_subject")
        res["sales_pitch_email"] = pitch_data.get("email_pitch") or res.get("sales_pitch_email")
        res["instagram_dm_pitch"] = pitch_data.get("instagram_dm_pitch")
        res["cold_call_script"] = pitch_data.get("cold_call_script")
        return res

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    # 0. Kurumsal Zincir Kontrolü (İsimden veya mevcut web adresinden)
    brand_url = resolve_known_brand_website(name)
    if brand_url:
        result["is_corporate_chain"] = True
        if not website or not website.strip():
            website = brand_url
            result["discovered_website"] = brand_url
            result["website_source"] = "brand_chain"

    # 1. Eğer haritada web sitesi yoksa Otomatik Web & Sosyal Medya Keşif Motorunu çalıştır
    if not website or not website.strip():
        discovered_url, discovered_socials = await _discover_website_and_socials(name, category, headers)
        if discovered_socials:
            result["social_links"].update(discovered_socials)
        if discovered_url:
            website = discovered_url
            result["discovered_website"] = discovered_url
            result["website_source"] = "web_search"
        else:
            _build_smart_fallback_analysis(name, category, result)
            await _attach_ai_pitches(result)
            return result
    else:
        result["discovered_website"] = website.strip()

    result["has_website"] = True
    clean_url = website.strip()
    if not clean_url.startswith("http"):
        clean_url = "https://" + clean_url

    try:
        start_time = time.perf_counter()
        html_content = ""
        final_url = clean_url

        async with httpx.AsyncClient(verify=True, headers=headers) as client:
            try:
                https_url = clean_url.replace("http://", "https://", 1)
                resp = await client.get(https_url, timeout=10.0, follow_redirects=True)
                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                final_url = str(resp.url)
                result["ssl_valid"] = final_url.startswith("https")
                result["http_status"] = resp.status_code
                result["response_time_ms"] = elapsed_ms
                html_content = resp.text
            except Exception:
                # SSL veya HTTPS bağlantı hatası durumunda HTTP üzerinden dene
                start_time = time.perf_counter()
                http_url = clean_url.replace("https://", "http://", 1)
                async with httpx.AsyncClient(verify=False, headers=headers) as fallback_client:
                    resp = await fallback_client.get(http_url, timeout=10.0, follow_redirects=True)
                    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                    final_url = str(resp.url)
                    result["ssl_valid"] = final_url.startswith("https")
                    result["http_status"] = resp.status_code
                    result["response_time_ms"] = elapsed_ms
                    html_content = resp.text

        result["discovered_website"] = final_url
        result["crawled_pages"].append("Ana Sayfa (/)")

        # 2. Derin Teknik, CMS ve SEO Analizi
        soup = BeautifulSoup(html_content, "html.parser")
        html_lower = html_content.lower()

        result["cms_platform"] = _detect_cms_platform(html_lower, soup)

        # Mobil uyumluluk (viewport meta)
        viewport = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
        if viewport and "width=device-width" in str(viewport).lower():
            result["mobile_ready"] = True

        # Title kontrolü
        if soup.title and soup.title.string and len(soup.title.string.strip()) > 1:
            result["has_title"] = True
            result["page_title"] = soup.title.string.strip()[:120]

        # Meta description kontrolü
        meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta_desc and meta_desc.get("content") and len(str(meta_desc.get("content")).strip()) > 5:
            result["has_meta_description"] = True
            result["meta_description"] = str(meta_desc.get("content")).strip()[:160]

        # H1 başlık kontrolü
        h1_tag = soup.find("h1")
        if h1_tag and len(h1_tag.get_text(strip=True)) > 1:
            result["has_h1"] = True
            result["h1_text"] = h1_tag.get_text(" ", strip=True)[:100]

        # OpenGraph (Sosyal medya paylaşım) etiketleri kontrolü
        og_title = soup.find("meta", attrs={"property": re.compile(r"^og:(title|image|description)$", re.I)})
        if og_title:
            result["has_og_tags"] = True

        # Schema.org (JSON-LD) yapısal veri kontrolü
        schema_tag = soup.find("script", attrs={"type": re.compile(r"application/ld\+json", re.I)})
        if schema_tag or "schema.org" in html_lower:
            result["has_schema"] = True

        # Favicon kontrolü
        fav_tag = soup.find("link", attrs={"rel": re.compile(r"icon", re.I)})
        if fav_tag:
            result["has_favicon"] = True

        # Google Analytics / GTM kontrolü
        if any(sig in html_lower for sig in ["googletagmanager.com", "google-analytics.com", "gtag(", "ga('create'"]):
            result["has_analytics"] = True

        # Meta / Facebook Pixel kontrolü
        if any(sig in html_lower for sig in ["connect.facebook.net", "fbq(", "facebook-jssdk"]):
            result["has_pixel"] = True

        # 3. Çok Sayfalı Derin İletişim ve Sosyal Medya Kazıma (Ana Sayfa + /iletisim, /hakkimizda)
        emails_set: set[str] = set()
        phones_set: set[str] = set()
        socials_map: dict[str, str] = dict(result["social_links"])

        wa_found = _extract_contacts_and_socials_from_doc(soup, html_content, emails_set, phones_set, socials_map)
        if wa_found:
            result["scraped_whatsapp"] = wa_found

        # Alt iletişim sayfalarını bul ve eşzamanlı tara
        subpage_urls = _find_contact_subpage_urls(soup, final_url)
        if subpage_urls:
            async def _fetch_subpage(sub_url: str) -> tuple[str, str]:
                try:
                    async with httpx.AsyncClient(verify=False, headers=headers, timeout=5.0, follow_redirects=True) as sc:
                        r = await sc.get(sub_url)
                        if r.status_code == 200 and r.text:
                            return sub_url, r.text
                except Exception:
                    pass
                return sub_url, ""

            sub_results = await asyncio.gather(*[_fetch_subpage(u) for u in subpage_urls])
            for sub_url, sub_html in sub_results:
                if not sub_html:
                    continue
                parsed_path = urlparse(sub_url).path or "/iletisim"
                result["crawled_pages"].append(parsed_path)
                sub_soup = BeautifulSoup(sub_html, "html.parser")
                sub_wa = _extract_contacts_and_socials_from_doc(sub_soup, sub_html, emails_set, phones_set, socials_map)
                if sub_wa and not result["scraped_whatsapp"]:
                    result["scraped_whatsapp"] = sub_wa

        result["scraped_emails"] = sorted(list(emails_set))[:5]
        result["scraped_phones"] = sorted(list(phones_set))[:5]
        result["social_links"] = socials_map

        # Önce kural tabanlı tam analizi oluştur
        _build_smart_fallback_analysis(name, category, result)

        # 4. Yapay Zeka (Google Gemini / Hibrit AI) Kişiselleştirilmiş Teklif Üretimi
        await _attach_ai_pitches(result)

    except Exception:
        result["ssl_valid"] = False
        result["mobile_ready"] = False
        result["score"] = 95
        result["ai_summary"] = (
            f"{name} işletmesinin kayıtlı web adresine ({website}) erişilememektedir. Alan adı süresi dolmuş, "
            f"sunucu kapanmış veya yapılandırma hatası mevcut olabilir. İşletmeye acil web sitesi yenileme, "
            f"alan adı/hosting kurtarma ve kurumsal dijital varlık paketi sunulabilir."
        )
        result["opportunities"] = [
            "Web Sitesi Kurtarma & Yeniden Kurulum",
            "Kurumsal Hosting & SSL Paketi",
            "Google İşletme Profili Güncellemesi"
        ]
        await _attach_ai_pitches(result)

    return result
