import os
import json
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel

load_dotenv()


class GeminiPitchOutput(BaseModel):
    recommended_package: str
    detected_pain_points: List[str]
    value_propositions: List[str]
    whatsapp_pitch: str
    email_subject: str
    email_pitch: str
    instagram_dm_pitch: str
    cold_call_script: str


def get_gemini_api_key(user_key: Optional[str] = None, override_key: Optional[str] = None) -> Optional[str]:
    if override_key and override_key.strip():
        return override_key.strip()
    if user_key and user_key.strip():
        return user_key.strip()
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    return env_key if env_key else None


def get_gemini_status(user_key: Optional[str] = None) -> Dict[str, Any]:
    key = get_gemini_api_key(user_key=user_key)
    masked = None
    if key and len(key) > 8:
        masked = f"{key[:6]}...{key[-4:]}"
    elif key:
        masked = "Tanımlı"
    return {
        "configured": bool(key),
        "masked_key": masked,
        "model": "gemini-2.5-flash"
    }


def _extract_pain_points_from_audit(name: str, category: Optional[str], audit: Dict[str, Any]) -> List[str]:
    points: List[str] = []
    has_website = bool(audit.get("has_website"))
    if not has_website:
        points.append("İşletmenin internette aktif bir web sitesi bulunmuyor")
        points.append("Google'da arama yapan müşteriler doğrudan rakip işletmelere yöneliyor")
        points.append("Müşterilerin telefondan hızlıca sipariş veya randevu verebileceği bir sayfa yok")
        return points

    if not audit.get("ssl_valid"):
        points.append("Sitede güvenli bağlantı (kilit simgesi) yok; giren kişilere 'Güvenli Değil' uyarısı çıkıyor")
    if not audit.get("mobile_ready"):
        points.append("Site cep telefonu ve tablet ekranlarına uyumlu değil, okuması zor görünüyor")
    if audit.get("response_time_ms") and int(audit["response_time_ms"]) > 2200:
        points.append(f"Site yavaş açılıyor ({audit['response_time_ms']} ms); müşteriler beklemeyip çıkabiliyor")
    if not audit.get("has_title") or not audit.get("has_meta_description"):
        points.append("Google aramalarında üst sırada çıkmayı sağlayan başlık ve tanıtım yazıları eksik")
    if not audit.get("has_h1"):
        points.append("Ana sayfada işletmenin ne iş yaptığını öne çıkaran ana başlık eksik")
    if not audit.get("has_schema"):
        points.append("Google Harita ve arama sonuçlarında adres/telefon bilgisini öne çıkaran kayıt eksik")
    if not audit.get("has_og_tags"):
        points.append("Site bağlantısı WhatsApp veya sosyal medyada paylaşıldığında resimli önizleme çıkmıyor")
    if not audit.get("has_analytics"):
        points.append("Siteye günde kaç kişinin girdiği takip edilmiyor")
    if not audit.get("has_pixel"):
        points.append("Siteye giren kişilere Instagram ve Facebook'ta tekrar reklam gösterilemiyor")

    if not points:
        points.append("Sitenin temel yapısı hazır; bölgesel reklamlarla müşteri sayısı artırılabilir")
    return points


def _build_dynamic_fallback_pitch(
    merchant_name: str,
    category: Optional[str],
    tone: str,
    focus_service: str,
    sender_name: Optional[str],
    agency_name: Optional[str],
    special_offer: Optional[str],
    custom_instruction: Optional[str],
    audit: Dict[str, Any]
) -> Dict[str, Any]:
    cat_label = category or "Yerel İşletme"
    has_website = bool(audit.get("has_website"))
    website_url = audit.get("discovered_website") or ""

    pain_points = _extract_pain_points_from_audit(merchant_name, cat_label, audit)

    focus_map = {
        "web_tasarim": "Telefon Uyumlu Yeni Web Sitesi Paketi",
        "yerel_seo": "Google Harita ve Arama Üst Sıra Paketi",
        "performans_reklam": "Instagram ve Google Müşteri Kazandırma Reklam Paketi",
        "e_ticaret": "Online Sipariş, Randevu ve WhatsApp Satış Paketi"
    }
    if focus_service in focus_map:
        recommended_package = focus_map[focus_service]
    else:
        if not has_website:
            recommended_package = f"{cat_label} İçin Telefon Uyumlu Web Sitesi ve Google Harita Paketi"
        elif not audit.get("ssl_valid") or not audit.get("mobile_ready"):
            recommended_package = "Web Sitesi Yenileme, Güvenli Bağlantı ve Telefon Uyumu Paketi"
        elif not audit.get("has_meta_description") or not audit.get("has_schema"):
            recommended_package = "Google Aramalarında Üst Sıraya Çıkma ve Harita Düzenleme Paketi"
        else:
            recommended_package = "Instagram / Google Reklam ve Yeni Müşteri Kazanım Paketi"

    value_propositions = [
        f"Bölgenizde '{cat_label}' arayan müşterilerin rakipler yerine doğrudan size ulaşması",
        "Müşterilerin telefondan tek tuşla WhatsApp siparişi, randevu veya yol tarifi alabilmesi",
        "Google ve sosyal medyada daha güvenilir ve özenli bir işletme görünümü kazanılması"
    ]

    sender_signature = ""
    if sender_name and agency_name:
        sender_signature = f"{sender_name} - {agency_name}"
    elif sender_name:
        sender_signature = sender_name
    elif agency_name:
        sender_signature = agency_name
    else:
        sender_signature = "Web ve Tanıtım Ekibi"

    offer_sentence_wa = f" Ayrıca bu haftaya özel fırsatımız: {special_offer.strip()}." if (special_offer and special_offer.strip()) else ""
    offer_block_email = f"\nSize Özel Fırsat: {special_offer.strip()}\n" if (special_offer and special_offer.strip()) else ""
    extra_note = f" ({custom_instruction.strip()})" if (custom_instruction and custom_instruction.strip()) else ""

    main_issue_short = pain_points[0] if pain_points else "internet görünürlüğü eksikleri"

    if tone == "samimi":
        greeting_wa = f"Merhaba {merchant_name} ailesi, hayırlı işler ve bol kazançlar dileriz!"
        closing_wa = f"Müsait olduğunuzda 5 dakika görüşüp hazırladığımız örnek çalışmayı göstermek isteriz.{offer_sentence_wa} Selamlar, {sender_signature}"
        greeting_email = f"Merhaba Değerli {merchant_name} Yetkilisi,"
    elif tone == "ikna_edici":
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi,"
        closing_wa = f"Bölgenizdeki müşterileri rakiplerinize kaptırmamak için hazırladığımız çalışmayı hemen başlatabiliriz.{offer_sentence_wa} Bugün 5 dakika görüşebilir miyiz? ({sender_signature})"
        greeting_email = f"Sayın {merchant_name} Yönetimi,"
    elif tone == "kisa_net":
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi,"
        closing_wa = f"Hazırladığımız örnek çalışmayı ve fiyat bilgisini göndermemi ister misiniz?{offer_sentence_wa} ({sender_signature})"
        greeting_email = f"Sayın {merchant_name} Yetkilisi,"
    else:
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi, iyi çalışmalar dileriz."
        closing_wa = f"İşletmeniz için hazırladığımız örnek çalışmayı ve kısa inceleme raporunu paylaşmamızı ister misiniz?{offer_sentence_wa} Saygılarımızla, {sender_signature}"
        greeting_email = f"Sayın {merchant_name} Yetkilisi,"

    if not has_website:
        whatsapp_pitch = (
            f"{greeting_wa} Bölgenizdeki {cat_label.lower()} işletmelerini incelerken {merchant_name} "
            f"için aktif bir internet sitesi olmadığını gördük. Google'da sizi arayan müşterilerin "
            f"hizmetlerinizi görmesi ve tek tuşla WhatsApp'tan size ulaşması için telefona uyumlu "
            f"web sitenizi hemen kurabiliriz.{extra_note} {closing_wa}"
        )
        email_subject = f"{merchant_name} - Yeni Web Sitesi ve Müşteri Kazanımı Önerisi"
        email_pitch = (
            f"Konu: {email_subject}\n\n"
            f"{greeting_email}\n\n"
            f"Bölgenizdeki {cat_label.lower()} işletmelerini incelerken {merchant_name} işletmenizin "
            f"haritada yer aldığını ancak müşterilerin inceleyebileceği bir internet sitesinin "
            f"olmadığını gördük.\n\n"
            f"Tespit Ettiğimiz Eksikler:\n"
            + "\n".join([f"- {p}" for p in pain_points])
            + f"\n\nÖnerdiğimiz Çözüm: {recommended_package}\n"
            + "\n".join([f"* {v}" for v in value_propositions])
            + f"{offer_block_email}\n"
            f"İşletmenize özel hazırladığımız örnek çalışmayı kısa bir görüşmede göstermekten "
            f"memnuniyet duyarız.\n\n"
            f"İyi çalışmalar dileriz,\n{sender_signature}"
        )
        instagram_dm_pitch = (
            f"Merhaba {merchant_name}! Sayfanızı inceledik. Google'da aranan müşterilerin size daha kolay "
            f"ulaşması ve Instagram'dan gelenlerin tek tuşla sipariş/randevu verebilmesi için size özel "
            f"bir web sitesi örneği hazırladık.{offer_sentence_wa} Örneği buradan göndermemi ister misiniz?"
        )
        cold_call_script = (
            f"1. AÇILIŞ: 'Merhaba, {merchant_name} yetkilisi ile mi görüşüyorum? Ben {sender_signature} ekibinden arıyorum, "
            f"1 dakikanız var mı?'\n"
            f"2. DURUM: 'Bölgenizdeki {cat_label.lower()} işletmelerine bakıyorduk. Haritada kaydınız var "
            f"fakat müşterilerin girebileceği bir internet siteniz görünmüyor.'\n"
            f"3. ÇÖZÜM: 'Google'dan arayan müşterilerin doğrudan WhatsApp hattınıza veya telefonunuza "
            f"ulaşmasını sağlayan {recommended_package} çalışmamız var.{offer_sentence_wa}'\n"
            f"4. KAPANIŞ: 'Hazırladığımız örnek görünümü incelemeniz için WhatsApp numaranıza gönderebilir miyim?'"
        )
    else:
        whatsapp_pitch = (
            f"{greeting_wa} {merchant_name} internet sitenizi ({website_url}) inceledik. "
            f"Siteniz açık ancak '{main_issue_short.lower()}' gibi müşteri kaybına yol açabilecek "
            f"bazı eksikler gördük.{extra_note} {closing_wa}"
        )
        email_subject = f"{merchant_name} ({website_url}) - Web Sitesi İnceleme ve İyileştirme Notları"
        email_pitch = (
            f"Konu: {email_subject}\n\n"
            f"{greeting_email}\n\n"
            f"{merchant_name} işletmenize ait ({website_url}) internet sitesini incelediğimizde, "
            f"daha fazla müşteri kazanmanızı sağlayacak bazı önemli noktalar tespit ettik.\n\n"
            f"Web Sitenizde Gördüğümüz Eksikler:\n"
            + "\n".join([f"- {p}" for p in pain_points])
            + f"\n\nÖnerdiğimiz Çözüm: {recommended_package}\n"
            + "\n".join([f"* {v}" for v in value_propositions])
            + f"{offer_block_email}\n"
            f"Bu eksikleri kısa sürede düzelterek sitenizden çok daha fazla müşteri gelmesini "
            f"sağlayabiliriz. Hazırladığımız inceleme raporunu paylaşmamız için bu e-postayı yanıtlamanız yeterlidir.\n\n"
            f"İyi çalışmalar dileriz,\n{sender_signature}"
        )
        instagram_dm_pitch = (
            f"Merhaba {merchant_name}! İnternet sitenizi ({website_url}) inceledik; {main_issue_short.lower()} "
            f"konusunda yapacağımız küçük bir düzenleme ile Google ve Instagram'dan gelen müşterilerinizi "
            f"artırabiliriz.{offer_sentence_wa} Kısa inceleme notumuzu buradan göndermemi ister misiniz?"
        )
        cold_call_script = (
            f"1. AÇILIŞ: 'Merhaba, {merchant_name} yetkilisi ile mi görüşüyorum? Ben {sender_signature} ekibinden arıyorum.'\n"
            f"2. DURUM: 'İşletmenizin {website_url} internet sitesini inceledik. Siteniz açık "
            f"ancak {main_issue_short.lower()} durumu yeni müşterilerin size ulaşmasını zorlaştırıyor.'\n"
            f"3. ÇÖZÜM: '{recommended_package} ile sitenizi telefona tam uyumlu, hızlı ve Google'da "
            f"üst sıralarda çıkacak hale getiriyoruz.{offer_sentence_wa}'\n"
            f"4. KAPANIŞ: 'Siteniz için çıkardığımız 1 sayfalık inceleme raporunu WhatsApp'tan size gönderebilir miyim?'"
        )

    return {
        "engine_used": "smart_hybrid_ai",
        "model_name": "Hazır Teklif Oluşturucu",
        "recommended_package": recommended_package,
        "detected_pain_points": pain_points,
        "value_propositions": value_propositions,
        "whatsapp_pitch": whatsapp_pitch,
        "email_subject": email_subject,
        "email_pitch": email_pitch,
        "instagram_dm_pitch": instagram_dm_pitch,
        "cold_call_script": cold_call_script,
    }


async def generate_personalized_pitch(
    merchant_name: str,
    category: Optional[str] = None,
    tone: str = "kurumsal",
    focus_service: str = "auto",
    sender_name: Optional[str] = None,
    agency_name: Optional[str] = None,
    special_offer: Optional[str] = None,
    custom_instruction: Optional[str] = None,
    audit_context: Optional[Dict[str, Any]] = None,
    gemini_api_key: Optional[str] = None,
    user_gemini_key: Optional[str] = None,
) -> Dict[str, Any]:
    audit = audit_context or {}

    fallback_result = _build_dynamic_fallback_pitch(
        merchant_name=merchant_name,
        category=category,
        tone=tone,
        focus_service=focus_service,
        sender_name=sender_name,
        agency_name=agency_name,
        special_offer=special_offer,
        custom_instruction=custom_instruction,
        audit=audit,
    )

    active_api_key = get_gemini_api_key(user_key=user_gemini_key, override_key=gemini_api_key)
    if not active_api_key:
        return fallback_result

    tone_descriptions = {
        "kurumsal": "Saygılı, güven veren ve anlaşılır iş dili",
        "samimi": "Sıcak, samimi, esnaf dostu ve içten konuşma dili",
        "ikna_edici": "Müşteri artışına ve kazanca odaklanan ikna edici dil",
        "kisa_net": "Çok kısa, net, doğrudan sonuca odaklanan dil",
    }
    focus_descriptions = {
        "auto": "İşletmenin eksiklerine göre en faydalı web ve tanıtım paketi",
        "web_tasarim": "Telefon Uyumlu Yeni Web Sitesi Kurulumu",
        "yerel_seo": "Google Harita ve Aramalarında Üst Sıraya Çıkma Çalışması",
        "performans_reklam": "Instagram ve Google Müşteri Kazandırma Reklamları",
        "e_ticaret": "Online Sipariş, Randevu ve WhatsApp Satış Sistemi",
    }

    prompt = f"""
Sen Türkiye'deki yerel esnaf ve işletmelere web sitesi, Google harita kaydı ve sosyal medya reklamı sunan bir danışmansın.
ÖNEMLİ KURAL: Yazacağın metinlerde ASLA yabancı veya karmaşık teknik terimler (SEO, SSL, HTTPS, Viewport, Schema.org, JSON-LD, OpenGraph, Meta Pixel, GTM, CRO, CMS vb.) KULLANMA.
Bunların yerine bir esnafın ilk okuyuşta anlayacağı günlük, sade ifadeler kullan ("güvenli bağlantı kilidi", "telefon uyumu", "Google'da üst sırada çıkma", "ziyaretçi sayacı", "Instagram reklam takibi" gibi).

[İŞLETME BİLGİLERİ]
- İşletme Adı: {merchant_name}
- Sektör: {category or 'Yerel İşletme'}
- Web Sitesi: {'Var (' + str(audit.get('discovered_website') or 'Mevcut') + ')' if audit.get('has_website') else 'YOK'}
- Güvenli Bağlantı (Kilit Simgesi): {'Var' if audit.get('ssl_valid') else 'Yok'}
- Telefon ve Tablet Uyumu: {'Uyumlu' if audit.get('mobile_ready') else 'Uyumsuz / Yok'}
- Google Başlık ve Tanıtım Yazısı: {'Tam' if (audit.get('has_title') and audit.get('has_meta_description')) else 'Eksik'}
- Ziyaretçi Sayacı ve Reklam Takibi: {'Kurulu' if (audit.get('has_analytics') or audit.get('has_pixel')) else 'Kurulu Değil'}

[TEKLİF AYARLARI]
- Konuşma Dili: {tone_descriptions.get(tone, tone_descriptions['kurumsal'])}
- Önerilecek Hizmet: {focus_descriptions.get(focus_service, focus_descriptions['auto'])}
- Gönderen Kişi: {sender_name or 'Web ve Tanıtım Danışmanı'}
- Firma Adı: {agency_name or 'Dijital Çözüm Ekibi'}
- Özel İndirim / Kampanya: {special_offer or 'Ücretsiz ön inceleme ve örnek çalışma sunumu'}
- Ek Not: {custom_instruction or 'Yok'}

Lütfen tüm alanları sade, samimi ve kavramlara boğmayan duru bir Türkçe ile doldur:
1. recommended_package: İşletmeye önerilen anlaşılır paket adı.
2. detected_pain_points: İşletmenin internet görünürlüğündeki 3-4 somut eksik (teknik terim olmadan).
3. value_propositions: Bu çalışmanın işletmeye kazandıracağı 3 somut fayda.
4. whatsapp_pitch: WhatsApp'tan gönderilecek, kolay okunan teklif mesajı.
5. email_subject: Sade ve anlaşılır e-posta konu başlığı.
6. email_pitch: Eksikleri ve çözümü sade bir dille anlatan e-posta metni.
7. instagram_dm_pitch: Instagram'dan gönderilecek kısa ve net mesaj.
8. cold_call_script: Telefonla arandığında adım adım söylenecek 4 maddelik konuşma metni.
"""

    for model_name in ("gemini-2.5-flash", "gemini-2.0-flash"):
        try:
            client = genai.Client(api_key=active_api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": GeminiPitchOutput,
                },
            )
            data = json.loads(response.text)
            return {
                "engine_used": "google_gemini",
                "model_name": model_name,
                "recommended_package": data.get("recommended_package") or fallback_result["recommended_package"],
                "detected_pain_points": data.get("detected_pain_points") or fallback_result["detected_pain_points"],
                "value_propositions": data.get("value_propositions") or fallback_result["value_propositions"],
                "whatsapp_pitch": data.get("whatsapp_pitch") or fallback_result["whatsapp_pitch"],
                "email_subject": data.get("email_subject") or fallback_result["email_subject"],
                "email_pitch": data.get("email_pitch") or fallback_result["email_pitch"],
                "instagram_dm_pitch": data.get("instagram_dm_pitch") or fallback_result["instagram_dm_pitch"],
                "cold_call_script": data.get("cold_call_script") or fallback_result["cold_call_script"],
            }
        except Exception:
            continue

    return fallback_result
