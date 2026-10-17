import httpx
from bs4 import BeautifulSoup
import os
import re
import time
import json
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List, Optional

load_dotenv()

class GeminiAuditResult(BaseModel):
    score: int
    ai_summary: str
    opportunities: list[str]
    sales_pitch_whatsapp: str
    sales_pitch_email: str


def _extract_contacts_and_socials(soup: BeautifulSoup, html_text: str) -> tuple[list[str], list[str], dict[str, str]]:
    emails = set()
    phones = set()
    socials: dict[str, str] = {}

    # 1. Extract from <a href="...">
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        href_lower = href.lower()
        if href_lower.startswith("mailto:"):
            mail = href[7:].split("?")[0].strip().lower()
            if "@" in mail and "." in mail.split("@")[-1]:
                emails.add(mail)
        elif href_lower.startswith("tel:"):
            tel = href[4:].split("?")[0].strip()
            digits = re.sub(r"\D", "", tel)
            if 10 <= len(digits) <= 13:
                phones.add(tel)
        elif "instagram.com/" in href_lower and "instagram" not in socials:
            socials["instagram"] = href
        elif ("facebook.com/" in href_lower or "fb.com/" in href_lower) and "facebook" not in socials:
            socials["facebook"] = href
        elif "linkedin.com/" in href_lower and "linkedin" not in socials:
            socials["linkedin"] = href
        elif ("wa.me/" in href_lower or "api.whatsapp.com" in href_lower) and "whatsapp" not in socials:
            socials["whatsapp"] = href
        elif "youtube.com/" in href_lower and "youtube" not in socials:
            socials["youtube"] = href

    # 2. Regex fallback for emails in visible text
    raw_emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", html_text[:50000])
    blocked_ext = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff", ".ttf")
    for mail in raw_emails:
        mail_clean = mail.lower().strip()
        if not mail_clean.endswith(blocked_ext) and not any(x in mail_clean for x in ["example.com", "sentry.io", "wixpress.com", "schema.org"]):
            emails.add(mail_clean)

    return sorted(list(emails))[:3], sorted(list(phones))[:3], socials


def _build_smart_fallback_analysis(name: str, category: str | None, result: dict) -> None:
    cat_label = category or "yerel işletme"
    if not result["has_website"]:
        result["score"] = 92
        result["ai_summary"] = (
            f"{name} ({cat_label}) için yapılan dijital taramada aktif bir kurumsal web sitesine rastlanmamıştır. "
            f"Bölgesel aramalarda potansiyel müşterilerin işletmeye doğrudan ulaşabilmesi için modern, mobil uyumlu "
            f"bir web sitesi ve Google Haritalar (Yerel SEO) optimizasyonu en yüksek öncelikli satış fırsatıdır."
        )
        result["opportunities"] = [
            "Kurumsal Web Sitesi Kurulumu",
            "Google İşletme Profili & Yerel SEO",
            "Online Randevu / İletişim Hattı Entegrasyonu",
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

    # Website exists: evaluate technical signals
    deficiencies = []
    opps = []
    score = 30

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

    if deficiencies:
        def_text = "; ayrıca ".join(deficiencies)
        result["ai_summary"] = (
            f"{name} web sitesi erişilebilir durumda ({result.get('response_time_ms', 0)} ms yanıt süresi), "
            f"ancak yapılan teknik röntgende {def_text}. Bu eksikliklerin giderilmesi işletmenin Google sıralamasını "
            f"ve müşteri dönüşüm oranını doğrudan artıracaktır."
        )
        main_issue = deficiencies[0]
    else:
        result["ai_summary"] = (
            f"{name} işletmesinin web sitesi temel SSL, mobil uyumluluk ve SEO kriterlerini sağlamaktadır. "
            f"Bu aşamada işletmeye bölgesel Google Ads reklam yönetimi, sosyal medya içerik üretimi ve "
            f"dönüşüm odaklı büyüme paketleri sunulabilir."
        )
        main_issue = "bölgesel arama motoru rekabetinde üst sıralara çıkma potansiyeli"

    result["opportunities"] = opps
    result["sales_pitch_whatsapp"] = (
        f"Merhaba {name} yetkilisi, işletmenizin web sitesini teknik olarak inceledik. Siteniz aktif ancak "
        f"{main_issue} konusunda iyileştirme fırsatları tespit ettik. Küçük bir revizyonla Google aramalarından "
        f"gelen müşteri trafiğinizi artırabiliriz. Hazırladığımız kısa teknik raporu paylaşmamızı ister misiniz?"
    )
    result["sales_pitch_email"] = (
        f"Konu: {name} Web Sitesi Teknik Analiz ve İyileştirme Raporu\n\n"
        f"Sayın {name} Yetkilisi,\n\n"
        f"İşletmenize ait web sitesi üzerinde gerçekleştirdiğimiz teknik denetimde öne çıkan bulgular aşağıdadır:\n"
        f"- SSL Güvenlik Durumu: {'Geçerli (HTTPS)' if result['ssl_valid'] else 'Eksik (Güvenli Değil Uyarısı)'}\n"
        f"- Mobil Uyumluluk: {'Uyumlu' if result['mobile_ready'] else 'Eksik (Mobil Cihazlarda Görünüm Sorunu)'}\n"
        f"- SEO Meta & Başlık Yapısı: {'Tam' if (result['has_title'] and result['has_meta_description']) else 'Eksik Etiketler Mevcut'}\n"
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
        "http_status": None,
        "response_time_ms": None,
        "has_title": False,
        "page_title": None,
        "has_meta_description": False,
        "has_h1": False,
        "has_analytics": False,
        "has_pixel": False,
        "scraped_emails": [],
        "scraped_phones": [],
        "social_links": {},
        "ai_summary": "",
        "opportunities": [],
        "sales_pitch_whatsapp": "",
        "sales_pitch_email": ""
    }
    
    if not website or not website.strip():
        _build_smart_fallback_analysis(name, category, result)
        return result
        
    result["has_website"] = True
    clean_url = website.strip()
    if not clean_url.startswith("http"):
        clean_url = "https://" + clean_url
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    try:
        start_time = time.perf_counter()
        html_content = ""
        
        async with httpx.AsyncClient(verify=True, headers=headers) as client:
            try:
                https_url = clean_url.replace("http://", "https://", 1)
                resp = await client.get(https_url, timeout=10.0, follow_redirects=True)
                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                result["ssl_valid"] = str(resp.url).startswith("https")
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
                    result["ssl_valid"] = False
                    result["http_status"] = resp.status_code
                    result["response_time_ms"] = elapsed_ms
                    html_content = resp.text
                
        # 2. Derin Teknik ve SEO Analizi
        soup = BeautifulSoup(html_content, "html.parser")
        html_lower = html_content.lower()
        
        # Mobil uyumluluk (viewport meta)
        viewport = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
        if viewport and "width=device-width" in str(viewport).lower():
            result["mobile_ready"] = True
            
        # Title kontrolü
        if soup.title and soup.title.string and len(soup.title.string.strip()) > 2:
            result["has_title"] = True
            result["page_title"] = soup.title.string.strip()[:120]

        # Meta description kontrolü
        meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta_desc and meta_desc.get("content") and len(str(meta_desc.get("content")).strip()) > 10:
            result["has_meta_description"] = True

        # H1 başlık kontrolü
        h1_tag = soup.find("h1")
        if h1_tag and len(h1_tag.get_text(strip=True)) > 1:
            result["has_h1"] = True

        # Google Analytics / GTM kontrolü
        if any(sig in html_lower for sig in ["googletagmanager.com", "google-analytics.com", "gtag(", "ga('create'"]):
            result["has_analytics"] = True

        # Meta / Facebook Pixel kontrolü
        if any(sig in html_lower for sig in ["connect.facebook.net", "fbq(", "facebook-jssdk"]):
            result["has_pixel"] = True

        # İletişim ve Sosyal Medya Kazıma (Scraping)
        emails, phones, socials = _extract_contacts_and_socials(soup, html_content)
        result["scraped_emails"] = emails
        result["scraped_phones"] = phones
        result["social_links"] = socials

        # Önce kural tabanlı tam analizi oluştur (hem yedek hem temel veri olarak)
        _build_smart_fallback_analysis(name, category, result)

        # 3. Gemini AI Analizi (Eğer GEMINI_API_KEY tanımlıysa daha derin ve özelleştirilmiş metin üret)
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key:
            try:
                page_text = " ".join(soup.stripped_strings)[:1500]
                ai_client = genai.Client(api_key=gemini_api_key)
                prompt = f"""
                Sen uzman bir dijital pazarlama ve B2B satış danışmanısın.
                İşletme Adı: {name}
                Sektör: {category or 'Genel'}
                Sayfa Başlığı: {result['page_title'] or 'Yok'}
                SSL Durumu: {'Var' if result['ssl_valid'] else 'Yok'}
                Mobil Uyumluluk: {'Var' if result['mobile_ready'] else 'Yok'}
                Meta Description: {'Var' if result['has_meta_description'] else 'Yok'}
                H1 Başlığı: {'Var' if result['has_h1'] else 'Yok'}
                Google Analytics: {'Var' if result['has_analytics'] else 'Yok'}
                Meta Pixel: {'Var' if result['has_pixel'] else 'Yok'}
                Yanıt Süresi: {result['response_time_ms']} ms
                Web Sitesi İçeriği Özeti: {page_text}
                
                Bu işletmeye hangi dijital hizmetler satılabilir? Kurumsal Türkçe ile analiz özeti (ai_summary),
                fırsat listesi (opportunities), doğrudan gönderilebilecek kısa WhatsApp satış mesajı (sales_pitch_whatsapp)
                ve kurumsal e-posta teklif metni (sales_pitch_email) üret.
                """
                
                ai_response = ai_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config={
                        'response_mime_type': 'application/json',
                        'response_schema': GeminiAuditResult,
                    },
                )
                ai_data = json.loads(ai_response.text)
                result["score"] = ai_data.get("score", result["score"])
                result["ai_summary"] = ai_data.get("ai_summary") or result["ai_summary"]
                result["opportunities"] = ai_data.get("opportunities") or result["opportunities"]
                result["sales_pitch_whatsapp"] = ai_data.get("sales_pitch_whatsapp") or result["sales_pitch_whatsapp"]
                result["sales_pitch_email"] = ai_data.get("sales_pitch_email") or result["sales_pitch_email"]
            except Exception:
                # Gemini API hatası veya kota durumunda hazır akıllı analiz korunur
                pass
            
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
        result["sales_pitch_whatsapp"] = (
            f"Merhaba {name} yetkilisi, işletmenizin iletişim bilgilerinde yer alan web adresinize ({website}) "
            f"şu anda erişilemediğini ve hata verdiğini fark ettik. Müşterilerinizin size kesintisiz ulaşabilmesi "
            f"için web sitenizi hızla yenileyip aktif hale getirebiliriz. Detayları paylaşmamızı ister misiniz?"
        )
        result["sales_pitch_email"] = (
            f"Konu: Önemli Bildirim - {name} Web Sitesi Erişim Sorunu ve Çözüm Önerisi\n\n"
            f"Sayın {name} Yetkilisi,\n\n"
            f"Bölgesel işletme taramamız sırasında işletmenize ait ({website}) web adresine şu anda erişilemediğini "
            f"tespit ettik. Web sitenizin kapalı olması, Google üzerinden sizi arayan potansiyel müşterilerin "
            f"rakip işletmelere yönelmesine neden olabilmektedir.\n\n"
            f"Teknik ekibimizle mevcut sitenizi hızla kurtarabilir veya yeni nesil, mobil uyumlu bir kurumsal site "
            f"ile dijital varlığınızı yeniden aktif hale getirebiliriz.\n\n"
            f"İyi çalışmalar dileriz."
        )
        
    return result
