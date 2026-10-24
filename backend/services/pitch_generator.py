import os
import json
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv, set_key
from google import genai
from pydantic import BaseModel

load_dotenv()

ENV_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


class GeminiPitchOutput(BaseModel):
    recommended_package: str
    detected_pain_points: List[str]
    value_propositions: List[str]
    whatsapp_pitch: str
    email_subject: str
    email_pitch: str
    instagram_dm_pitch: str
    cold_call_script: str


def get_gemini_api_key(override_key: Optional[str] = None) -> Optional[str]:
    if override_key and override_key.strip():
        return override_key.strip()
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    return key if key else None


def get_gemini_status() -> Dict[str, Any]:
    key = get_gemini_api_key()
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


def save_gemini_api_key(api_key: str) -> Dict[str, Any]:
    clean_key = (api_key or "").strip()
    os.environ["GEMINI_API_KEY"] = clean_key
    try:
        if not os.path.exists(ENV_FILE_PATH):
            with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
                f.write(f"GEMINI_API_KEY={clean_key}\n")
        else:
            set_key(ENV_FILE_PATH, "GEMINI_API_KEY", clean_key)
    except Exception:
        pass
    return get_gemini_status()


def _extract_pain_points_from_audit(name: str, category: Optional[str], audit: Dict[str, Any]) -> List[str]:
    points: List[str] = []
    has_website = bool(audit.get("has_website"))
    if not has_website:
        points.append("İşletmeye ait aktif bir kurumsal web sitesi bulunmuyor")
        points.append("Google organik aramalarında potansiyel müşteriler rakip işletmelere yöneliyor")
        points.append("Dijital katalog, online randevu/sipariş ve WhatsApp dönüşüm altyapısı eksik")
        return points

    if not audit.get("ssl_valid"):
        points.append("SSL güvenlik sertifikası (HTTPS) geçersiz; tarayıcılar 'Güvenli Değil' uyarısı veriyor")
    if not audit.get("mobile_ready"):
        points.append("Web sitesi mobil cihazlarla (akıllı telefon/tablet) uyumlu değil")
    if audit.get("response_time_ms") and int(audit["response_time_ms"]) > 2200:
        points.append(f"Sayfa açılış hızı yavaş ({audit['response_time_ms']} ms); ziyaretçi terk oranını artırıyor")
    if not audit.get("has_title") or not audit.get("has_meta_description"):
        points.append("Google SEO başlık (Title) ve Meta açıklama (Description) etiketleri eksik")
    if not audit.get("has_h1"):
        points.append("Sayfa içi ana başlık (H1) hiyerarşisi bulunmuyor")
    if not audit.get("has_schema"):
        points.append("Google Harita ve zengin arama sonuçları için Schema.org (JSON-LD) yapısal verisi yok")
    if not audit.get("has_og_tags"):
        points.append("WhatsApp ve sosyal medya paylaşımları için OpenGraph önizleme etiketleri eksik")
    if not audit.get("has_analytics"):
        points.append("Ziyaretçi trafiğini ölçen Google Analytics 4 / Tag Manager kurulu değil")
    if not audit.get("has_pixel"):
        points.append("Yeniden pazarlama (Retargeting) reklamları için Meta / Facebook Pixel bulunmuyor")

    if not points:
        points.append("Mevcut dijital altyapı güçlü; bölgesel Google Ads ve dönüşüm hunisi ile ciro büyütülebilir")
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
    cms_platform = audit.get("cms_platform") or "Mevcut Web Altyapısı"
    response_ms = audit.get("response_time_ms")

    pain_points = _extract_pain_points_from_audit(merchant_name, cat_label, audit)

    # Odak hizmet paketini belirle
    focus_map = {
        "web_tasarim": "Yeni Nesil Mobil Uyumlu Web Sitesi & Kurumsal Kimlik Paketi",
        "yerel_seo": "Google Haritalar (Yerel SEO) & Bölgesel Müşteri Kazanım Paketi",
        "performans_reklam": "Google / Instagram Dönüşüm Reklamları & Meta Pixel Kurulum Paketi",
        "e_ticaret": "Online Sipariş / Rezervasyon & Doğrudan WhatsApp Satış Otomasyonu"
    }
    if focus_service in focus_map:
        recommended_package = focus_map[focus_service]
    else:
        if not has_website:
            recommended_package = f"{cat_label} Sektörüne Özel Mobil Uyumlu Web & Google Harita Paketi"
        elif not audit.get("ssl_valid") or not audit.get("mobile_ready"):
            recommended_package = "Web Sitesi Modernizasyon, SSL Güvenlik & Mobil Hızlandırma Paketi"
        elif not audit.get("has_meta_description") or not audit.get("has_schema"):
            recommended_package = "Teknik SEO, Schema.org Yapısal Veri & Bölgesel Görünürlük Paketi"
        else:
            recommended_package = "Meta Pixel, Google Analytics & Performans Reklam Büyüme Paketi"

    # Değer önerileri (Value propositions)
    value_propositions = [
        f"Bölgenizde '{cat_label}' araması yapan potansiyel müşterilerin rakipler yerine doğrudan size ulaşması",
        "Mobil cihazlardan tek tıkla WhatsApp siparişi, randevu ve yol tarifi dönüşümü sağlanması",
        "Google arama motoru ve sosyal medya reklamlarında ölçülebilir, yüksek geri dönüşümlü dijital altyapı"
    ]

    sender_signature = ""
    if sender_name and agency_name:
        sender_signature = f"{sender_name} | {agency_name}"
    elif sender_name:
        sender_signature = sender_name
    elif agency_name:
        sender_signature = agency_name
    else:
        sender_signature = "Dijital Büyüme ve Web Çözümleri Danışmanlığı"

    offer_sentence_wa = f" Ayrıca bu haftaya özel: {special_offer.strip()}." if (special_offer and special_offer.strip()) else ""
    offer_block_email = f"\nÖzel Kampanya Notumuz: {special_offer.strip()}\n" if (special_offer and special_offer.strip()) else ""
    extra_note = f" ({custom_instruction.strip()})" if (custom_instruction and custom_instruction.strip()) else ""

    main_issue_short = pain_points[0] if pain_points else "dijital görünürlük eksikleri"
    second_issue_short = pain_points[1] if len(pain_points) > 1 else "bölgesel SEO optimizasyonu ihtiyacı"

    # Tona göre selamlama ve kapanış
    if tone == "samimi":
        greeting_wa = f"Merhaba {merchant_name} ailesi, hayırlı işler ve bol kazançlar dileriz!"
        closing_wa = f"Uygun görürseniz 5 dakikalık kısa bir görüşmede örnek çalışmamızı paylaşmak isteriz.{offer_sentence_wa} Selamlar, {sender_signature}"
        greeting_email = f"Merhaba Değerli {merchant_name} Yetkilisi,"
    elif tone == "ikna_edici":
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi,"
        closing_wa = f"Bölgenizdeki müşteri trafiğini rakiplerinize kaptırmamak adına hazırladığımız '{recommended_package}' çözümünü hemen bugün devreye alabiliriz.{offer_sentence_wa} Bugün 10 dakika görüşebilir miyiz? - {sender_signature}"
        greeting_email = f"Sayın {merchant_name} Yönetimi,"
    elif tone == "kisa_net":
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi,"
        closing_wa = f"Konuyla ilgili size özel hazırladığımız demo ve fiyat teklifini iletmemizi ister misiniz?{offer_sentence_wa} ({sender_signature})"
        greeting_email = f"Sayın {merchant_name} Yetkilisi,"
    else:  # kurumsal
        greeting_wa = f"Merhaba {merchant_name} Yetkilisi, iyi çalışmalar dileriz."
        closing_wa = f"İşletmenize özel hazırladığımız '{recommended_package}' kapsamını ve örnek raporu paylaşmamızı ister misiniz?{offer_sentence_wa} Saygılarımızla, {sender_signature}"
        greeting_email = f"Sayın {merchant_name} Yetkilisi,"

    if not has_website:
        whatsapp_pitch = (
            f"{greeting_wa} Bölgenizdeki {cat_label.lower()} işletmeleri üzerine yaptığımız dijital görünürlük "
            f"incelemesinde, {merchant_name} için aktif bir web sitesi kaydının bulunmadığını tespit ettik. "
            f"Google ve haritalarda sizi arayan müşterilerin doğrudan size ulaşabilmesi için mobil uyumlu, "
            f"WhatsApp sipariş/randevu entegrasyonlu kurumsal web sitenizi anahtar teslim kurabiliriz.{extra_note} "
            f"{closing_wa}"
        )
        email_subject = f"{merchant_name} - Dijital Görünürlük Analizi ve {recommended_package} Önerisi"
        email_pitch = (
            f"Konu: {email_subject}\n\n"
            f"{greeting_email}\n\n"
            f"Bölgenizdeki {cat_label.lower()} sektörüne yönelik gerçekleştirdiğimiz dijital varlık taramasında, "
            f"{merchant_name} işletmenizin Google Haritalar üzerinde yer aldığını ancak müşterilerin hizmetlerinizi "
            f"inceleyebileceği kurumsal bir web sitesinin bulunmadığını gözlemledik.\n\n"
            f"Teknik Analiz Bulgularımız:\n"
            + "\n".join([f"- {p}" for p in pain_points])
            + f"\n\nÖnerilen Çözüm Paketi: {recommended_package}\n"
            + "\n".join([f"* {v}" for v in value_propositions])
            + f"{offer_block_email}\n"
            f"İşletmenize özel hazırladığımız örnek tasarım çalışmasını ve yol haritasını 10 dakikalık "
            f"bir görüşmede sunmaktan memnuniyet duyarız.\n\n"
            f"Saygılarımızla,\n{sender_signature}"
        )
        instagram_dm_pitch = (
            f"Merhaba {merchant_name}! Profilinizi ve hizmetlerinizi inceledik. İşletmenizin Google aramalarında "
            f"daha üst sıralarda çıkması ve Instagram profilinize gelen ziyaretçilerin tek tıkla randevu/sipariş "
            f"verebilmesi için size özel bir mobil web sitesi taslağı hazırladık.{offer_sentence_wa} "
            f"Örnek bağlantıyı buradan paylaşmamı ister misiniz?"
        )
        cold_call_script = (
            f"1. AÇILIŞ: 'Merhaba, {merchant_name} yetkilisi ile mi görüşüyorum? Ben {sender_signature} ekibinden arıyorum, "
            f"vaktinizi 1 dakika alabilir miyim?'\n"
            f"2. TESPİT: 'Bölgenizdeki {cat_label.lower()} işletmelerinin Google Harita ve web görünürlüğünü inceliyorduk. "
            f"İşletmenizin harita kaydı mevcut ancak bağlı bir kurumsal web sitesi görünmüyor.'\n"
            f"3. DEĞER ÖNERİSİ: 'Müşterilerin Google aramalarından doğrudan WhatsApp hattınıza veya telefonunuza "
            f"düşmesini sağlayan {recommended_package} çalışmamız var.{offer_sentence_wa}'\n"
            f"4. KAPANIŞ / RANDEVU: 'Hazırladığımız örnek taslağı incelemeniz için WhatsApp numaranıza göndermemi ister misiniz?'"
        )
    else:
        speed_note = f" ({response_ms} ms açılış süresi)" if response_ms else ""
        whatsapp_pitch = (
            f"{greeting_wa} {merchant_name} işletmenizin web sitesini ({website_url} - {cms_platform}{speed_note}) "
            f"teknik olarak inceledik. Siteniz aktif olmakla birlikte; '{main_issue_short.lower()}' ve "
            f"'{second_issue_short.lower()}' gibi müşteri dönüşümünü etkileyen önemli noktalar tespit ettik.{extra_note} "
            f"{closing_wa}"
        )
        email_subject = f"{merchant_name} ({website_url}) - Teknik Web Röntgeni ve Dönüşüm İyileştirme Raporu"
        email_pitch = (
            f"Konu: {email_subject}\n\n"
            f"{greeting_email}\n\n"
            f"{merchant_name} işletmenize ait ({website_url}) web sitesi üzerinde gerçekleştirdiğimiz teknik "
            f"altyapı ({cms_platform}), SEO ve reklam pikseli incelemesinde dijital cironuzu artırabilecek "
            f"önemli iyileştirme fırsatları tespit ettik.\n\n"
            f"Web Sitenizde Tespit Edilen Teknik Bulgular:\n"
            + "\n".join([f"- {p}" for p in pain_points])
            + f"\n\nÖnerilen Çözüm Paketi: {recommended_package}\n"
            + "\n".join([f"* {v}" for v in value_propositions])
            + f"{offer_block_email}\n"
            f"Bu eksikleri hızla gidererek web sitenizi çok daha fazla müşteri getiren bir satış kanalına "
            f"dönüştürebiliriz. Ücretsiz teknik analiz özetimizi paylaşmamız için bu e-postayı yanıtlamanız yeterlidir.\n\n"
            f"Saygılarımızla,\n{sender_signature}"
        )
        instagram_dm_pitch = (
            f"Merhaba {merchant_name}! Web sitenizi ({website_url}) inceledik; {main_issue_short.lower()} "
            f"konusunda hızlı bir iyileştirme ile hem Google sıralamanızı hem de Instagram reklam dönüşümlerinizi "
            f"artırabiliriz.{offer_sentence_wa} Kısa analiz notumuzu DM üzerinden iletmemi ister misiniz?"
        )
        cold_call_script = (
            f"1. AÇILIŞ: 'Merhaba, {merchant_name} yetkilisi ile mi görüşüyorum? Ben {sender_signature} ekibinden arıyorum.'\n"
            f"2. TESPİT: 'İşletmenizin {website_url} web sitesini teknik olarak inceledik. Siteniz {cms_platform} altyapısında "
            f"ancak {main_issue_short.lower()} durumu Google sıralamanızı ve müşteri dönüşümünüzü olumsuz etkiliyor.'\n"
            f"3. DEĞER ÖNERİSİ: '{recommended_package} ile sitenizin hız, SEO ve reklam takip altyapısını "
            f"kısa sürede eksiksiz hale getiriyoruz.{offer_sentence_wa}'\n"
            f"4. KAPANIŞ / RANDEVU: 'Sitenize özel çıkardığımız 1 sayfalık teknik röntgen raporunu WhatsApp üzerinden size iletebilir miyim?'"
        )

    return {
        "engine_used": "smart_hybrid_ai",
        "model_name": "EsnafRadar Akıllı Teklif Motoru (Hibrit AI)",
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
) -> Dict[str, Any]:
    audit = audit_context or {}

    # Önce her durumda eksiksiz ve bağlama duyarlı baz teklifi hazırla
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

    active_api_key = get_gemini_api_key(gemini_api_key)
    if not active_api_key:
        return fallback_result

    tone_descriptions = {
        "kurumsal": "Resmi, kurumsal, güven veren profesyonel B2B danışmanlık üslubu",
        "samimi": "Sıcak, samimi, yerel esnaf dostu ve içten üslup",
        "ikna_edici": "Ciro artışına, rakip avantajına ve hızlı aksiyona odaklanan yüksek ikna edici satış üslubu",
        "kisa_net": "Çok kısa, net, doğrudan sonuca ve randevuya odaklanan yönetici özeti üslubu",
    }
    focus_descriptions = {
        "auto": "Teknik röntgen bulgularına göre en yüksek fayda sağlayacak dijital hizmet paketi",
        "web_tasarim": "Yeni Nesil Mobil Uyumlu Web Sitesi, Kurumsal Kimlik ve Hız Optimizasyonu",
        "yerel_seo": "Google Haritalar (Yerel SEO), Schema.org Yapısal Veri ve Bölgesel Müşteri Kazanımı",
        "performans_reklam": "Instagram / Google Ads Reklam Yönetimi, Meta Pixel ve Google Analytics Dönüşüm Hunisi",
        "e_ticaret": "Online Sipariş, Rezervasyon ve WhatsApp Satış Otomasyonu",
    }

    prompt = f"""
Sen Türkiye'deki yerel işletmelere (esnaf ve KOBİ'lere) dijital dönüşüm, web tasarım, SEO ve performans pazarlaması satan kıdemli bir B2B satış stratejistisin.

Aşağıdaki işletme ve teknik röntgen verilerini kullanarak kişiselleştirilmiş, yüksek dönüşümlü satış teklifleri üret:

[İŞLETME BİLGİLERİ]
- İşletme Adı: {merchant_name}
- Sektör / Kategori: {category or 'Yerel İşletme'}
- Web Sitesi Durumu: {'Mevcut (' + str(audit.get('discovered_website') or 'Var') + ')' if audit.get('has_website') else 'YOK (Web sitesi bulunmuyor)'}
- Web Altyapısı (CMS): {audit.get('cms_platform') or 'Belirsiz / Yok'}
- SSL Sertifikası (HTTPS): {'Geçerli' if audit.get('ssl_valid') else 'Yok / Güvensiz'}
- Mobil Uyumluluk (Viewport): {'Uyumlu' if audit.get('mobile_ready') else 'Uyumsuz / Yok'}
- Yanıt Süresi: {str(audit.get('response_time_ms')) + ' ms' if audit.get('response_time_ms') else 'Ölçülemedi'}
- Sayfa Başlığı (Title): {audit.get('page_title') or ('Var' if audit.get('has_title') else 'Eksik')}
- H1 Ana Başlık: {audit.get('h1_text') or ('Var' if audit.get('has_h1') else 'Eksik')}
- Meta Description: {audit.get('meta_description') or ('Var' if audit.get('has_meta_description') else 'Eksik')}
- OpenGraph Etiketleri: {'Var' if audit.get('has_og_tags') else 'Eksik'}
- Schema.org Yapısal Veri: {'Var' if audit.get('has_schema') else 'Eksik'}
- Google Analytics / GTM: {'Kurulu' if audit.get('has_analytics') else 'Kurulu Değil'}
- Meta / Facebook Pixel: {'Kurulu' if audit.get('has_pixel') else 'Kurulu Değil'}
- Tespit Edilen Fırsatlar: {', '.join(audit.get('opportunities') or [])}

[TEKLİF PARAMETRELERİ]
- İstenen Üslup / Ton: {tone_descriptions.get(tone, tone_descriptions['kurumsal'])}
- Odaklanılacak Hizmet: {focus_descriptions.get(focus_service, focus_descriptions['auto'])}
- Gönderici Adı: {sender_name or 'Dijital Dönüşüm Danışmanı'}
- Ajans / Firma Adı: {agency_name or 'EsnafRadar Dijital Çözüm Ekibi'}
- Özel Kampanya / Fırsat Teklifi: {special_offer or 'Ücretsiz ön inceleme ve demo sunumu'}
- Ek Talimat: {custom_instruction or 'Yok'}

Lütfen tüm alanları akıcı, ikna edici ve özenli bir Türkçe ile doldur:
1. recommended_package: İşletmeye önerilen net paket adı.
2. detected_pain_points: İşletmenin mevcut dijital durumundaki en kritik 3-4 somut eksiklik.
3. value_propositions: Teklif edilen çözümün işletmeye sağlayacağı 3 somut ticari kazanç.
4. whatsapp_pitch: Doğrudan WhatsApp'tan gönderilmeye hazır, samimi ama profesyonel, tek paragrafta okunabilir satış mesajı.
5. email_subject: Dikkat çekici kurumsal e-posta konu başlığı.
6. email_pitch: Hitap, tespit edilen teknik bulgular, çözüm önerisi ve kapanış çağrısı içeren kapsamlı e-posta metni.
7. instagram_dm_pitch: Instagram DM üzerinden gönderilebilecek kısa, merak uyandırıcı mesaj.
8. cold_call_script: Telefonla arandığında kullanılacak 4 adımlı (1. Açılış, 2. Tespit, 3. Değer Önerisi, 4. Kapanış/Randevu) konuşma senaryosu.
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
