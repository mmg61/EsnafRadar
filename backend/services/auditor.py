import asyncio
import httpcore
import httpx
from bs4 import BeautifulSoup
import ipaddress
import os
import re
import socket
import time
import json
from urllib.parse import urljoin, urlparse, unquote
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import List, Optional
from services.brands import resolve_known_brand_website

load_dotenv()

_BLOCKED_HOST_EXACT = {"localhost", "0.0.0.0", "::1"}
_BLOCKED_HOST_SUFFIXES = (".local", ".internal", ".localhost", ".lan", ".home", ".arpa")


def _is_disallowed_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped is not None:
        ip_obj = ip_obj.ipv4_mapped
    return (
        not ip_obj.is_global
        or ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_reserved
        or ip_obj.is_unspecified
    )


def _is_blocked_hostname(hostname: str) -> bool:
    clean = (hostname or "").strip().lower().rstrip(".")
    if not clean:
        return True
    if clean in _BLOCKED_HOST_EXACT or clean.endswith(_BLOCKED_HOST_SUFFIXES):
        return True
    return False


def _resolve_verified_public_ip(hostname: str, port: int) -> str:
    """
    Alan adını çözümler, dönen TÜM IP adreslerinin genel (public) olduğunu doğrular
    ve doğrulanmış ilk genel IP adresini döndürür. İç ağ veya geçersiz adreslerde ValueError fırlatır.
    """
    clean_host = (hostname or "").strip().lower().rstrip(".")
    if _is_blocked_hostname(clean_host):
        raise ValueError(f"Engellenen alan adı: {clean_host}")

    try:
        ip_obj = ipaddress.ip_address(clean_host)
        if _is_disallowed_ip(ip_obj):
            raise ValueError(f"Engellenen iç ağ IP adresi: {clean_host}")
        return str(ip_obj)
    except ValueError as exc:
        if "Engellenen" in str(exc):
            raise

    addr_info = socket.getaddrinfo(clean_host, port, proto=socket.IPPROTO_TCP)
    if not addr_info:
        raise ValueError(f"DNS çözümlenemedi: {clean_host}")

    verified_ips: list[str] = []
    for item in addr_info:
        ip_str = item[4][0]
        ip_obj = ipaddress.ip_address(ip_str)
        if _is_disallowed_ip(ip_obj):
            raise ValueError(f"DNS iç ağ IP adresine çözümlendi (DNS Rebinding / SSRF engellendi): {ip_str}")
        verified_ips.append(ip_str)

    return verified_ips[0]


def _is_safe_public_url(raw_url: str) -> bool:
    """
    SSRF Koruması: Yalnızca http/https şemasına sahip ve genel (public) IP adreslerine
    çözümlenen dış alan adlarına izin verir. localhost, 127.x, 10.x, 172.16-31.x, 192.168.x,
    169.254.x (metadata) ve özel IPv6 adreslerini engeller.
    """
    try:
        parsed = urlparse(raw_url.strip())
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = (parsed.hostname or "").strip().lower().rstrip(".")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        _resolve_verified_public_ip(hostname, port)
        return True
    except Exception:
        return False


class _SafePublicNetworkBackend(httpcore.AsyncNetworkBackend):
    """
    DNS Rebinding Korumalı Ağ Katmanı:
    Her TCP bağlantısında alan adını tek seferde çözümler, tüm IP'lerin public olduğunu doğrular
    ve soketi doğrudan doğrulanmış IP'ye bağlar. TLS katmanı (SNI) ve HTTP Host başlığı orijinal
    alan adını koruduğu için verify=True sertifika doğrulaması eksiksiz çalışır ve ikinci bir DNS
    sorgusu (TOCTOU açığı) asla oluşmaz.
    """

    def __init__(self, inner: httpcore.AsyncNetworkBackend) -> None:
        self._inner = inner

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options=None,
    ):
        clean_host = (host or "").strip().lower().rstrip(".")
        if _is_blocked_hostname(clean_host):
            raise httpcore.ConnectError(f"İç ağ alan adına bağlantı engellendi: {clean_host}")

        try:
            ip_obj = ipaddress.ip_address(clean_host)
            if _is_disallowed_ip(ip_obj):
                raise httpcore.ConnectError(f"İç ağ IP adresine bağlantı engellendi: {clean_host}")
            verified_ip = str(ip_obj)
        except ValueError:
            loop = asyncio.get_running_loop()
            try:
                addr_info = await loop.getaddrinfo(clean_host, port, type=socket.SOCK_STREAM)
            except Exception as exc:
                raise httpcore.ConnectError(f"DNS çözümleme hatası: {clean_host}") from exc
            if not addr_info:
                raise httpcore.ConnectError(f"DNS kaydı bulunamadı: {clean_host}")
            verified_ips: list[str] = []
            for item in addr_info:
                ip_str = item[4][0]
                ip_candidate = ipaddress.ip_address(ip_str)
                if _is_disallowed_ip(ip_candidate):
                    raise httpcore.ConnectError(f"SSRF / DNS Rebinding engellendi: {ip_str}")
                verified_ips.append(ip_str)
            verified_ip = verified_ips[0]

        return await self._inner.connect_tcp(
            verified_ip,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )

    async def connect_unix_socket(self, path: str, timeout: float | None = None, socket_options=None):
        raise httpcore.ConnectError("Unix socket bağlantıları güvenlik nedeniyle devre dışıdır.")

    async def sleep(self, seconds: float) -> None:
        await self._inner.sleep(seconds)


def _create_safe_async_client(headers: dict[str, str] | None = None, timeout: float = 10.0) -> httpx.AsyncClient:
    """Zorunlu TLS doğrulaması (verify=True) ve DNS-sabitlemeli SSRF koruması ile AsyncClient üretir."""
    transport = httpx.AsyncHTTPTransport(verify=True)
    transport._pool._network_backend = _SafePublicNetworkBackend(transport._pool._network_backend)
    return httpx.AsyncClient(
        transport=transport,
        verify=True,
        headers=headers,
        timeout=timeout,
        follow_redirects=False,
    )


async def _safe_get_with_redirects(
    client: httpx.AsyncClient,
    url: str,
    timeout: float = 10.0,
    max_redirects: int = 4,
    params: dict[str, str] | None = None,
) -> httpx.Response:
    """Her yönlendirme (redirect) adımında şema ve SSRF kontrolü yaparak güvenli HTTP isteği gerçekleştirir."""
    current_url = url
    current_params = params
    for _ in range(max_redirects + 1):
        parsed = urlparse(current_url.strip())
        if parsed.scheme not in ("http", "https") or _is_blocked_hostname(parsed.hostname or ""):
            raise ValueError(f"Güvenlik nedeniyle iç ağ veya geçersiz adrese erişim engellendi: {current_url}")
        resp = await client.get(current_url, params=current_params, timeout=timeout, follow_redirects=False)
        current_params = None
        if resp.status_code in (301, 302, 303, 307, 308):
            loc = resp.headers.get("location")
            if not loc:
                return resp
            current_url = urljoin(str(resp.url), loc)
            continue
        return resp
    raise ValueError("Çok fazla yönlendirme (redirect) tespit edildi.")

class GeminiAuditResult(BaseModel):
    score: int
    ai_summary: str
    opportunities: list[str]
    sales_pitch_whatsapp: str
    sales_pitch_email: str


DIRECTORY_BLACKLIST = {
    "duckduckgo.com", "google.com", "google.com.tr", "goo.gl", "maps.app.goo.gl",
    "bing.com", "yahoo.com", "yandex.com", "yandex.com.tr",
    "facebook.com", "fb.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
    "wa.me", "whatsapp.com", "t.me", "linktr.ee", "pinterest.com", "foursquare.com", "swarmapp.com",
    "tripadvisor.com", "tripadvisor.com.tr", "yelp.com", "yelp.com.tr", "sikayetvar.com",
    "eksisozluk.com", "wikipedia.org", "bulurum.com", "yellowpages.com.tr", "birmilyonnokta.com",
    "yemeksepeti.com", "getir.com", "trendyol.com", "hepsiburada.com", "n11.com", "amazon.com.tr",
    "akakce.com", "cimri.com", "sahibinden.com", "hepsiemlak.com", "emlakjet.com", "zingat.com",
    "kariyer.net", "iskur.gov.tr", "armut.com", "ustasiyapsin.com", "tavsiyeediyorum.com",
    "doktortakvimi.com", "doktorsitesi.com", "eniyihekim.com", "kolayrandevu.com",
    "findglocal.com", "cylex.com.tr", "haritamap.com", "nerede360.com", "mekanist.net",
    "neredekal.com", "otelz.com", "etstur.com", "tatilbudur.com", "jollytur.com",
    "booking.com", "hotels.com", "airbnb.com", "agoda.com", "obilet.com", "enuygun.com",
    "zomato.com", "harita.gov.tr", "turkiye.gov.tr", "etbis.gov.tr", "rehber.com",
    "firmarehberi.com", "turkcebilgi.com", "hurriyet.com.tr", "milliyet.com.tr", "sabah.com.tr",
    "haberturk.com", "sozcu.com.tr", "cumhuriyet.com.tr", "ntv.com.tr", "cnn.com", "onedio.com",
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
    if len(digits) == 14 and digits.startswith("0090"):
        digits = "0" + digits[4:]
    elif len(digits) == 13 and digits.startswith("900"):
        digits = "0" + digits[3:]
    elif len(digits) == 12 and digits.startswith("90"):
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


_ASCII_TR_MAP = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")

_GENERIC_STOP_TOKENS = {
    "ve", "ile", "ltd", "sti", "as", "san", "tic", "ticaret", "sanayi", "subesi", "sube",
    "merkez", "merkezi", "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya",
    "kadikoy", "besiktas", "sisli", "uskudar", "maltepe", "atasehir", "bakirkoy", "fatih",
    "beyoglu", "kartal", "pendik", "umraniye", "sariyer", "ozel", "yeni", "eski", "meshur",
    "kardesler", "ogullari", "grup", "group", "yerel", "isletme",
}

_SECTOR_WORDS = {
    "restoran", "restaurant", "lokanta", "lokantasi", "kafe", "cafe", "kahve", "firin", "unlu",
    "pastane", "pastanesi", "kebap", "pide", "doner", "kofte", "balik", "kasap", "sarkuteri",
    "kuafor", "kuaforu", "berber", "guzellik", "bakim", "spa", "masaj",
    "oto", "otomotiv", "tamir", "servis", "servisi", "yikama", "lastik", "galeri",
    "market", "bakkal", "butik", "giyim", "ayakkabi", "kuyumcu", "optik", "cicek", "cicekci",
    "kitap", "kirtasiye", "mobilya", "nalbur", "hirdavat", "petshop",
    "eczane", "eczanesi", "dis", "klinik", "klinigi", "poliklinik", "doktor", "veteriner", "medikal",
    "emlak", "gayrimenkul", "hukuk", "avukat", "muhasebe", "sigorta", "turizm", "terzi",
    "fotograf", "mimarlik", "elektrik", "tesisat", "cilingir", "marangoz", "otel", "pansiyon", "spor", "gym",
}


def _ascii_tokens(text: str) -> list[str]:
    low = (text or "").replace("İ", "i").replace("I", "ı").lower().translate(_ASCII_TR_MAP)
    return [t for t in re.split(r"[^a-z0-9]+", low) if len(t) >= 2]


def _extract_merchant_identity_tokens(name: str, category: Optional[str]) -> tuple[list[str], list[str]]:
    """
    İşletme adından:
    1) Ayırt edici özel isim kelimelerini (distinctive_tokens)
    2) Sektör / meslek anahtar kelimelerini (sector_tokens)
    ayrıştırır.
    """
    raw_tokens = _ascii_tokens(name)
    cat_tokens = [t for t in _ascii_tokens(category or "") if t not in _GENERIC_STOP_TOKENS]

    distinctive: list[str] = []
    sector: list[str] = []
    for tok in raw_tokens:
        if tok in _GENERIC_STOP_TOKENS:
            continue
        if tok in _SECTOR_WORDS:
            if tok not in sector:
                sector.append(tok)
        elif len(tok) >= 3 and tok not in distinctive:
            distinctive.append(tok)

    for ct in cat_tokens:
        if ct in _SECTOR_WORDS and ct not in sector:
            sector.append(ct)

    return distinctive, sector


def _build_compound_domain_slugs(name: str) -> list[str]:
    """
    Yalnızca en az 2 anlamlı kelimeden oluşan tam birleşik alan adı adayları üretir.
    Tek kelimelik ('yildiz.com', 'guven.com.tr', 'moda.com' gibi) kör tahminler yanlış eşleşme ürettiği için yapılmaz.
    """
    tokens = [t for t in _ascii_tokens(name) if t not in {"ve", "ile", "ltd", "sti", "as", "san", "tic", "subesi", "sube"}]
    if len(tokens) < 2:
        return []

    slugs: list[str] = []
    joined_all = "".join(tokens[:3])
    if 6 <= len(joined_all) <= 28:
        slugs.append(joined_all)

    if len(tokens) >= 3:
        joined_two = "".join(tokens[:2])
        if 6 <= len(joined_two) <= 24 and joined_two not in slugs:
            slugs.append(joined_two)

    return slugs[:2]


_PARKED_OR_INVALID_MARKERS = (
    "domain for sale", "this domain is for sale", "buy this domain", "satılık domain",
    "satilik domain", "satılık alan adı", "bu alan adı satılıktır", "sedoparking",
    "hugedomains", "afternic", "dan.com", "parkingcrew", "bodis.com",
    "apache2 ubuntu default", "welcome to nginx", "index of /", "cgi-sys/defaultwebpage",
    "account suspended", "site yapım aşamasında", "deneme bonusu", "sweet bonanza", "casino",
)


async def _verify_candidate_belongs_to_merchant(
    candidate_url: str,
    name: str,
    category: Optional[str],
    merchant_phone: Optional[str],
    headers: dict[str, str],
) -> Optional[str]:
    """
    Aday web sayfasını indirir ve gerçekten aranan yerel işletmeye ait olup olmadığını
    başlık, H1, sektör uyumu, Türkçe içerik ve telefon numarası üzerinden doğrular.
    Şüpheli veya alakasız sitelerde None döndürerek yanlış web sitesi atanmasını engeller.
    """
    if not _is_safe_public_url(candidate_url):
        return None

    try:
        async with _create_safe_async_client(headers=headers, timeout=3.5) as client:
            resp = await _safe_get_with_redirects(client, candidate_url, timeout=3.5, max_redirects=3)
            if resp.status_code >= 400 or not resp.text or len(resp.text) < 350:
                return None

            final_parsed = urlparse(str(resp.url))
            final_domain = (final_parsed.hostname or "").lower().replace("www.", "")
            if not final_domain or _is_blocked_hostname(final_domain):
                return None
            if any(final_domain == blk or final_domain.endswith("." + blk) for blk in DIRECTORY_BLACKLIST):
                return None

            html_sample = resp.text[:45000]
            low_raw = html_sample.lower()
            if any(marker in low_raw for marker in _PARKED_OR_INVALID_MARKERS):
                return None

            soup = BeautifulSoup(html_sample, "html.parser")
            title_txt = soup.title.string.strip() if (soup.title and soup.title.string) else ""
            h1_el = soup.find("h1")
            h1_txt = h1_el.get_text(" ", strip=True) if h1_el else ""
            og_site_el = soup.find("meta", attrs={"property": "og:site_name"})
            og_site_txt = str(og_site_el.get("content", "")).strip() if og_site_el else ""
            meta_desc_el = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
            meta_desc_txt = str(meta_desc_el.get("content", "")).strip() if meta_desc_el else ""

            header_raw = f"{title_txt} {h1_txt} {og_site_txt} {meta_desc_txt}"
            header_ascii = header_raw.replace("İ", "i").replace("I", "ı").lower().translate(_ASCII_TR_MAP)
            body_visible = " ".join(soup.stripped_strings)[:25000]
            body_ascii = body_visible.replace("İ", "i").replace("I", "ı").lower().translate(_ASCII_TR_MAP)
            domain_clean = final_domain.split(".")[0].replace("-", "")

            distinctive_tokens, sector_tokens = _extract_merchant_identity_tokens(name, category)

            # 1. Telefon numarası eşleşmesi (en kesin doğrulama)
            if merchant_phone:
                target_digits = re.sub(r"\D", "", merchant_phone)[-10:]
                if len(target_digits) == 10:
                    page_digits_blob = re.sub(r"\D", "", html_sample)
                    if target_digits in page_digits_blob:
                        if not distinctive_tokens or any(t in header_ascii or t in domain_clean for t in distinctive_tokens):
                            return f"{final_parsed.scheme}://{final_parsed.netloc}"

            # Türkçe site / yerel işletme sinyali kontrolü (Yabancı dildeki global siteleri eler)
            has_turkish_signal = (
                final_domain.endswith(".tr")
                or any(ch in (header_raw + body_visible[:4000]) for ch in "çğıöşüÇĞİÖŞÜ")
                or any(w in body_ascii for w in ("iletisim", "hakkimizda", "adres", "telefon", "hizmetlerimiz", "randevu"))
            )
            if not has_turkish_signal:
                return None

            if not distinctive_tokens:
                return None

            # 2. En az 2 ayırt edici isim kelimesi varsa (Örn: "Moda Akdeniz Veteriner")
            if len(distinctive_tokens) >= 2:
                must_match = distinctive_tokens[:2]
                if all(tok in header_ascii or tok in domain_clean for tok in must_match):
                    if not sector_tokens or any(st in header_ascii or st in body_ascii for st in sector_tokens):
                        return f"{final_parsed.scheme}://{final_parsed.netloc}"
                return None

            # 3. Tek ayırt edici kelime varsa (Örn: "Yıldız Kuaför"):
            # "Yıldız Holding" veya başka sektördeki "Yıldız" firmalarıyla karışmaması için
            # hem alan adında hem sayfa başlığında ayırt edici kelime VE sektör kelimesi birlikte geçmelidir.
            single_tok = distinctive_tokens[0]
            if len(single_tok) < 4 or not sector_tokens:
                return None
            if (
                single_tok in domain_clean
                and single_tok in header_ascii
                and any(st in header_ascii for st in sector_tokens)
            ):
                return f"{final_parsed.scheme}://{final_parsed.netloc}"

            return None
    except Exception:
        return None


async def _discover_website_and_socials(
    name: str,
    category: Optional[str],
    headers: dict[str, str],
    merchant_phone: Optional[str] = None,
) -> tuple[Optional[str], dict[str, str]]:
    """
    Haritada web sitesi kaydı bulunmayan işletmeler için:
    1) Bilinen kurumsal zincir sözlüğünü sıkı kurallarla kontrol eder.
    2) DuckDuckGo HTML araması ve çok kelimeli alan adı adaylarını bulur.
    3) Bulunan her adayın içeriğini indirerek işletme adı, sektör, Türkçe içerik ve telefonla doğrular.
    """
    discovered_socials: dict[str, str] = {}

    # 1. Bilinen Kurumsal Zincir kontrolü
    brand_url = resolve_known_brand_website(name)
    if brand_url:
        return brand_url, discovered_socials

    distinctive_tokens, _ = _extract_merchant_identity_tokens(name, category)
    compound_slugs = _build_compound_domain_slugs(name)
    candidate_sites: list[str] = []

    # 2. DuckDuckGo HTML Araması ile Aday Web & Sosyal Medya Keşfi
    try:
        query = f'"{name}" {category or ""}'.strip()
        async with _create_safe_async_client(headers=headers, timeout=4.5) as client:
            resp = await _safe_get_with_redirects(
                client,
                "https://html.duckduckgo.com/html/",
                timeout=4.5,
                max_redirects=2,
                params={"q": query},
            )
            if resp.status_code == 200 and resp.text:
                soup = BeautifulSoup(resp.text, "html.parser")
                for a_tag in soup.select("a.result__a, a.result__url"):
                    raw_href = a_tag.get("href", "")
                    if "uddg=" in raw_href:
                        raw_href = unquote(raw_href.split("uddg=")[-1].split("&")[0])
                    if not raw_href.startswith("http"):
                        continue

                    parsed = urlparse(raw_href)
                    if parsed.scheme not in ("http", "https"):
                        continue
                    domain = (parsed.hostname or "").lower().replace("www.", "")
                    if not domain or _is_blocked_hostname(domain):
                        continue

                    # Sosyal medya profili yakalama (yalnızca işletme adı token'ı URL'de geçiyorsa)
                    href_ascii = raw_href.lower().translate(_ASCII_TR_MAP)
                    matches_social_handle = bool(
                        distinctive_tokens and any(tok in href_ascii for tok in distinctive_tokens[:2])
                    )
                    if "instagram.com" in domain and "instagram" not in discovered_socials:
                        if matches_social_handle and not any(x in raw_href.lower() for x in ["/p/", "/reel/", "/explore/"]):
                            discovered_socials["instagram"] = raw_href
                        continue
                    if "facebook.com" in domain and "facebook" not in discovered_socials:
                        if matches_social_handle:
                            discovered_socials["facebook"] = raw_href
                        continue
                    if "linkedin.com" in domain and "linkedin" not in discovered_socials:
                        if matches_social_handle:
                            discovered_socials["linkedin"] = raw_href
                        continue

                    if any(domain == blk or domain.endswith("." + blk) for blk in DIRECTORY_BLACKLIST):
                        continue

                    domain_root = domain.split(".")[0].replace("-", "")
                    candidate_site = f"{parsed.scheme}://{parsed.netloc}"
                    if distinctive_tokens and any(len(t) >= 4 and t in domain_root for t in distinctive_tokens[:2]):
                        if candidate_site not in candidate_sites:
                            candidate_sites.append(candidate_site)
                            if len(candidate_sites) >= 3:
                                break
    except Exception:
        pass

    # 3. Çok kelimeli birleşik alan adı adaylarını ekle
    for s in compound_slugs:
        for u in (f"https://www.{s}.com.tr", f"https://www.{s}.com"):
            if u not in candidate_sites:
                candidate_sites.append(u)

    # 4. Aday siteleri gerçek içerik doğrulamasından geçir
    if candidate_sites:
        verify_tasks = [
            _verify_candidate_belongs_to_merchant(u, name, category, merchant_phone, headers)
            for u in candidate_sites[:5]
        ]
        verified_results = await asyncio.gather(*verify_tasks)
        for verified_url in verified_results:
            if verified_url:
                return verified_url, discovered_socials

    return None, discovered_socials


def _build_smart_fallback_analysis(name: str, category: str | None, result: dict) -> None:
    cat_label = category or "yerel işletme"
    if not result["has_website"]:
        result["score"] = 92
        result["ai_summary"] = (
            f"{name} ({cat_label}) için internette aktif bir web sitesi bulunamadı. "
            f"Google'da arama yapan müşterilerin işletmeye kolayca ulaşabilmesi için "
            f"telefona uyumlu bir tanıtım sitesi kurulması ve Google Harita kaydının düzenlenmesi "
            f"en öncelikli ihtiyaçtır."
        )
        result["opportunities"] = [
            "Yeni Web Sitesi Kurulumu",
            "Google Harita Kaydı ve Üst Sıra Çalışması",
            "WhatsApp Hızlı Sipariş ve Randevu Hattı",
            "Sosyal Medya Sayfa Düzenlemesi"
        ]
        result["sales_pitch_whatsapp"] = (
            f"Merhaba {name} yetkilisi, bölgenizdeki {cat_label} işletmelerini incelerken "
            f"işletmenizin internet sitesinin olmadığını fark ettik. Google'da sizi arayan müşterilerin "
            f"doğrudan size ulaşmasını sağlayacak telefon uyumlu web sitesi ve Google Harita çalışmamız "
            f"hakkında kısa bilgi paylaşmak isteriz. Müsait olduğunuzda görüşebilir miyiz?"
        )
        result["sales_pitch_email"] = (
            f"Konu: {name} - İnternet Görünürlüğü ve Yeni Müşteri Kazanımı\n\n"
            f"Sayın {name} Yetkilisi,\n\n"
            f"Bölgenizdeki {cat_label} işletmelerini incelerken işletmenize ait aktif bir web sitesi "
            f"bulunmadığını gördük.\n\n"
            f"Bugün müşterilerin büyük çoğunluğu hizmet almadan önce Google üzerinden arama yapmaktadır. "
            f"İşletmenize özel hazırlayacağımız telefona uyumlu web sitesi ve Google Harita düzenlemesi ile "
            f"bölgenizdeki müşterileri doğrudan size yönlendirebiliriz.\n\n"
            f"Örnek çalışmamızı göstermek için uygun olduğunuzda kısa bir görüşme yapabiliriz.\n\n"
            f"İyi çalışmalar dileriz."
        )
        return

    # Kurumsal zincir şubesi kontrolü
    if result.get("is_corporate_chain"):
        result["score"] = 20
        result["ai_summary"] = (
            f"{name} bilinen bir zincir mağaza şubesidir ve kendi merkezi web sitesi "
            f"({result.get('discovered_website') or 'mevcut'}) bulunmaktadır. Tekil esnaf yerine "
            f"bağımsız yerel işletmelere odaklanılması daha uygundur."
        )
        result["opportunities"] = [
            "Kurumsal Zincir Şubesi",
            "Bölgesel Tanıtım İşbirliği"
        ]
        result["sales_pitch_whatsapp"] = (
            f"Merhaba {name} yetkilisi, bölgenizdeki şubeniz için yürüttüğümüz yerel tanıtım "
            f"çalışmamız hakkında bilgi paylaşmak isteriz."
        )
        result["sales_pitch_email"] = (
            f"Konu: {name} - Bölgesel Tanıtım İşbirliği\n\n"
            f"Sayın {name} Yetkilisi,\n\n"
            f"Bölgesel tanıtım projelerimiz kapsamında işletmenizle işbirliği imkanlarını "
            f"değerlendirmek isteriz.\n\n"
            f"İyi çalışmalar dileriz."
        )
        return

    # Yerel işletmenin web sitesi mevcut: Sade ve anlaşılır değerlendirme
    deficiencies = []
    opps = []
    score = 28

    if not result["ssl_valid"]:
        deficiencies.append("güvenli bağlantı (kilit simgesi) yok ve siteye girerken 'Güvenli Değil' uyarısı çıkıyor")
        opps.append("Güvenli Bağlantı (SSL) Kurulumu")
        score += 20

    if not result["mobile_ready"]:
        deficiencies.append("site telefon ve tablet ekranlarına uyumlu değil, yazılar küçük veya kaymış görünüyor")
        opps.append("Telefon ve Tablet Uyumlu Yenileme")
        score += 20

    if not result["has_title"] or not result["has_meta_description"] or not result["has_h1"]:
        deficiencies.append("Google aramalarında üst sırada çıkmayı sağlayan başlık ve tanıtım yazıları eksik")
        opps.append("Google Üst Sıra (Arama) Düzenlemesi")
        score += 15

    if not result.get("has_schema"):
        opps.append("Google Harita ve İşletme Kimlik Kaydı")
        score += 6

    if not result["has_analytics"] and not result["has_pixel"]:
        deficiencies.append("siteye kaç kişinin girdiği ve reklamdan gelen müşteriler takip edilmiyor")
        opps.append("Ziyaretçi Sayacı ve Reklam Takip Kurulumu")
        score += 12
    elif not result["has_pixel"]:
        opps.append("Instagram ve Facebook Reklam Takip Kurulumu")
        score += 6

    if result.get("response_time_ms") and result["response_time_ms"] > 2000:
        deficiencies.append(f"site yavaş açılıyor ({result['response_time_ms']} ms)")
        opps.append("Site Açılış Hızını Artırma")
        score += 8

    if not opps:
        opps = ["Site İçerik Yenileme", "Google ve Instagram Reklam Yönetimi", "WhatsApp Hızlı İletişim Butonu"]

    result["score"] = min(95, max(25, score))

    discovery_note = ""
    if result.get("website_source") in ("auto_discovered", "web_search") and result.get("discovered_website"):
        discovery_note = f"Haritada yazılı olmayan web sitesi ({result['discovered_website']}) otomatik olarak bulundu. "

    if deficiencies:
        def_text = "; ayrıca ".join(deficiencies)
        result["ai_summary"] = (
            f"{discovery_note}{name} işletmesinin bir web sitesi var ancak yapılan incelemede {def_text}. "
            f"Bu eksikler giderildiğinde müşteriler siteye daha çok güvenecek ve Google aramalarından "
            f"daha fazla müşteri gelecektir."
        )
        main_issue = deficiencies[0]
    else:
        result["ai_summary"] = (
            f"{discovery_note}{name} işletmesinin web sitesi genel olarak düzgün çalışıyor. "
            f"Müşteri sayısını artırmak için bölgesel Google ve Instagram reklamları ile "
            f"WhatsApp hızlı sipariş/randevu hattı önerilebilir."
        )
        main_issue = "Google ve sosyal medya üzerinden daha fazla müşteri çekme fırsatı"

    result["opportunities"] = opps
    result["sales_pitch_whatsapp"] = (
        f"Merhaba {name} yetkilisi, işletmenizin web sitesini inceledik. "
        f"Siteniz açık ancak {main_issue} olduğunu fark ettik. Küçük bir düzenlemeyle Google'dan "
        f"gelen müşterilerinizi artırabiliriz. Hazırladığımız kısa inceleme notunu paylaşmamızı ister misiniz?"
    )
    result["sales_pitch_email"] = (
        f"Konu: {name} Web Sitesi İnceleme Notları\n\n"
        f"Sayın {name} Yetkilisi,\n\n"
        f"İşletmenizin web sitesini incelediğimizde dikkat çeken noktalar şunlardır:\n"
        f"- Güvenli Bağlantı (Kilit Simgesi): {'Var' if result['ssl_valid'] else 'Yok (Güvenli Değil Uyarısı Veriyor)'}\n"
        f"- Telefon Uyumu: {'Uygun' if result['mobile_ready'] else 'Eksik (Telefonda Düzgün Görünmüyor)'}\n"
        f"- Google Başlık ve Tanıtım Yazısı: {'Tam' if (result['has_title'] and result['has_meta_description']) else 'Eksik'}\n"
        f"- Ziyaretçi ve Reklam Takibi: {'Kurulu' if (result['has_analytics'] or result['has_pixel']) else 'Kurulu Değil'}\n\n"
        f"Bu eksikleri düzelterek sitenizden daha fazla müşteri gelmesini sağlayabiliriz. "
        f"Detayları konuşmak için geri dönüşünüzü bekleriz.\n\n"
        f"İyi çalışmalar dileriz."
    )


async def run_audit(
    name: str,
    website: str | None,
    category: Optional[str] = None,
    user_gemini_key: Optional[str] = None,
    sender_name: Optional[str] = None,
    agency_name: Optional[str] = None,
    phone: Optional[str] = None,
) -> dict:
    # Gelen website adresi sosyal medya veya rehber bağlantısıysa resmi web sitesi sayma
    initial_socials: dict[str, str] = {}
    if website and website.strip():
        w_cand = website.strip()
        if not w_cand.lower().startswith(("http://", "https://")):
            w_cand = "https://" + w_cand
        try:
            p_init = urlparse(w_cand)
            h_init = (p_init.hostname or "").lower().replace("www.", "")
            if "instagram.com" in h_init:
                initial_socials["instagram"] = w_cand
                website = None
            elif "facebook.com" in h_init or "fb.com" in h_init:
                initial_socials["facebook"] = w_cand
                website = None
            elif any(h_init == blk or h_init.endswith("." + blk) for blk in DIRECTORY_BLACKLIST):
                website = None
        except Exception:
            website = None

    result = {
        "audit_schema_v": 2,
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
            sender_name=sender_name,
            agency_name=agency_name,
            audit_context=res,
            user_gemini_key=user_gemini_key,
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

    if initial_socials:
        result["social_links"].update(initial_socials)

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
        discovered_url, discovered_socials = await _discover_website_and_socials(
            name, category, headers, merchant_phone=phone
        )
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

    if not _is_safe_public_url(clean_url):
        result["has_website"] = False
        result["discovered_website"] = None
        _build_smart_fallback_analysis(name, category, result)
        await _attach_ai_pitches(result)
        return result

    try:
        start_time = time.perf_counter()
        html_content = ""
        final_url = clean_url

        async with _create_safe_async_client(headers=headers, timeout=10.0) as client:
            try:
                https_url = clean_url.replace("http://", "https://", 1)
                resp = await _safe_get_with_redirects(client, https_url, timeout=10.0)
                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                final_url = str(resp.url)
                result["ssl_valid"] = final_url.startswith("https")
                result["http_status"] = resp.status_code
                result["response_time_ms"] = elapsed_ms
                html_content = resp.text
            except Exception:
                # HTTPS sertifikası geçersiz veya HTTPS kapalıysa yalnızca güvenli HTTP üzerinden dene (verify=True korunur)
                start_time = time.perf_counter()
                http_url = clean_url.replace("https://", "http://", 1)
                resp = await _safe_get_with_redirects(client, http_url, timeout=10.0)
                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                final_url = str(resp.url)
                result["ssl_valid"] = False
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
                    async with _create_safe_async_client(headers=headers, timeout=5.0) as sc:
                        r = await _safe_get_with_redirects(sc, sub_url, timeout=5.0, max_redirects=2)
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
