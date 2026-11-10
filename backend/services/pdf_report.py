import os
from datetime import datetime
from typing import Dict, Any, List
from fpdf import FPDF
from services.auditor import _normalize_tr_phone


def _find_font_paths() -> tuple[str | None, str | None]:
    candidates = [
        (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
        (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for reg, bold in candidates:
        if os.path.exists(reg) and os.path.exists(bold):
            return reg, bold
    return None, None


def _sanitize_ascii_fallback(text: str) -> str:
    replacements = {
        "ğ": "g", "Ğ": "G",
        "ü": "u", "Ü": "U",
        "ş": "s", "Ş": "S",
        "ı": "i", "İ": "I",
        "ö": "o", "Ö": "O",
        "ç": "c", "Ç": "C",
        "•": "-", "—": "-", "–": "-",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "replace").decode("latin-1")


def generate_audit_pdf_bytes(payload: Dict[str, Any]) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    reg_font, bold_font = _find_font_paths()
    has_unicode_font = False
    font_family = "Helvetica"

    if reg_font and bold_font:
        try:
            pdf.add_font("TRFont", "", reg_font)
            pdf.add_font("TRFont", "B", bold_font)
            font_family = "TRFont"
            has_unicode_font = True
        except Exception:
            has_unicode_font = False

    def txt(val: Any) -> str:
        s = str(val or "").strip()
        return s if has_unicode_font else _sanitize_ascii_fallback(s)

    raw_phone = payload.get("phone")
    normalized_phone = (_normalize_tr_phone(str(raw_phone)) or str(raw_phone)) if raw_phone else "Belirtilmemis"

    merchant_name = txt(payload.get("merchant_name") or "Isletme")
    category = txt(payload.get("category") or "Yerel Isletme")
    website = txt(payload.get("website") or "Web sitesi bulunmuyor")
    phone = txt(normalized_phone)
    email = txt(payload.get("email") or "Belirtilmemis")
    score = int(payload.get("score") or 0)
    date_str = datetime.now().strftime("%d.%m.%Y %H:%M")

    # 1. Üst Başlık Bandı
    pdf.set_fill_color(15, 23, 42)  # Koyu lacivert
    pdf.rect(10, 10, 190, 26, style="F")

    pdf.set_xy(15, 14)
    pdf.set_font(font_family, "B", 14)
    pdf.set_text_color(16, 185, 129)  # Zümrüt yeşili
    pdf.cell(120, 8, txt("ESNAFRADAR - ISLETME INCELEME RAPORU"), ln=0)

    pdf.set_font(font_family, "", 9.5)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(60, 8, txt(f"Tarih: {date_str}"), ln=1, align="R")

    pdf.set_x(15)
    pdf.set_font(font_family, "B", 12.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(180, 9, merchant_name, ln=1)

    pdf.ln(8)

    # 2. İşletme Kimlik ve Puan Özeti
    pdf.set_fill_color(241, 245, 249)
    pdf.set_draw_color(203, 213, 225)
    start_y = pdf.get_y()
    pdf.rect(10, start_y, 190, 30, style="DF")

    pdf.set_xy(14, start_y + 4)
    pdf.set_font(font_family, "B", 10.5)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(130, 6.5, txt(f"Sektor: {category}"), ln=0)

    pdf.set_font(font_family, "B", 11)
    pdf.set_text_color(5, 150, 105)
    pdf.cell(52, 6.5, txt(f"Ihtiyac Puani: {score} / 100"), ln=1, align="R")

    pdf.set_x(14)
    pdf.set_font(font_family, "", 9.5)
    pdf.set_text_color(51, 65, 85)
    pdf.cell(182, 6.5, txt(f"Web Adresi: {website}"), ln=1)
    pdf.set_x(14)
    pdf.cell(90, 6.5, txt(f"Telefon: {phone}"), ln=0)
    pdf.cell(92, 6.5, txt(f"E-posta: {email}"), ln=1)

    pdf.set_y(start_y + 35)

    # 3. Genel Değerlendirme
    pdf.set_font(font_family, "B", 11.5)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 8, txt("1. Genel Degerlendirme"), ln=1)

    pdf.set_font(font_family, "", 10)
    pdf.set_text_color(51, 65, 85)
    summary_text = txt(payload.get("ai_summary") or "Isletme incelemesi tamamlandi.")
    pdf.multi_cell(190, 6, summary_text)
    pdf.ln(5)

    # 4. Web Sitesi Kontrol Tablosu (10 Anlaşılır Kriter)
    pdf.set_font(font_family, "B", 11.5)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 8, txt("2. Web Sitesi Durum Kontrolu"), ln=1)

    checks = [
        ("Web Sitesi", bool(payload.get("has_website")), "Mevcut", "Yok"),
        ("Guvenli Baglanti (Kilit Simgesi)", bool(payload.get("ssl_valid")), "Var (Guvenli)", "Yok (Uyari Veriyor)"),
        ("Telefon ve Tablet Uyumu", bool(payload.get("mobile_ready")), "Uyumlu", "Uyumsuz / Eksik"),
        ("Google Arama Basligi", bool(payload.get("has_title")), "Mevcut", "Eksik"),
        ("Google Tanitim Yazisi", bool(payload.get("has_meta_description")), "Mevcut", "Eksik"),
        ("Ana Sayfa Basligi", bool(payload.get("has_h1")), "Mevcut", "Eksik"),
        ("WhatsApp / Sosyal Medya Onizlemesi", bool(payload.get("has_og_tags")), "Mevcut", "Eksik"),
        ("Google Harita Kimlik Bilgisi", bool(payload.get("has_schema")), "Kayitli", "Eksik"),
        ("Ziyaretci Sayaci", bool(payload.get("has_analytics")), "Kurulu", "Kurulu Degil"),
        ("Instagram / Facebook Reklam Takibi", bool(payload.get("has_pixel")), "Kurulu", "Kurulu Degil"),
    ]

    pdf.set_font(font_family, "B", 9.5)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(125, 7, txt(" Kontrol Edilen Ozellik"), border=1, fill=True)
    pdf.cell(65, 7, txt(" Durum"), border=1, ln=1, fill=True)

    pdf.set_font(font_family, "", 9.5)
    for label, ok, ok_text, fail_text in checks:
        pdf.set_text_color(30, 41, 59)
        pdf.cell(125, 6.5, txt(f" {label}"), border=1)
        if ok:
            pdf.set_text_color(5, 150, 105)
            pdf.cell(65, 6.5, txt(f" [TAMAM] {ok_text}"), border=1, ln=1)
        else:
            pdf.set_text_color(220, 38, 38)
            pdf.cell(65, 6.5, txt(f" [EKSIK] {fail_text}"), border=1, ln=1)

    pdf.ln(6)

    # 5. Tespit Edilen Eksikler ve Önerilen Çözüm
    pdf.set_font(font_family, "B", 11.5)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 8, txt("3. Tespit Edilen Eksikler ve Cozum Onerisi"), ln=1)

    recommended_pkg = txt(payload.get("recommended_package") or "Dijital Gorunurluk ve Web Paketi")
    pdf.set_font(font_family, "B", 10)
    pdf.set_text_color(5, 150, 105)
    pdf.cell(190, 7, txt(f"Onerilen Paket: {recommended_pkg}"), ln=1)

    pain_points: List[str] = payload.get("detected_pain_points") or payload.get("opportunities") or []
    if pain_points:
        pdf.set_font(font_family, "B", 9.5)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(190, 6.5, txt("Giderilmesi Gereken Eksikler:"), ln=1)
        pdf.set_font(font_family, "", 9.5)
        pdf.set_text_color(51, 65, 85)
        for pt in pain_points[:5]:
            pdf.multi_cell(190, 5.5, txt(f" - {pt}"))

    value_props: List[str] = payload.get("value_propositions") or []
    if value_props:
        pdf.ln(2)
        pdf.set_font(font_family, "B", 9.5)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(190, 6.5, txt("Isletmeye Saglayacagi Faydalar:"), ln=1)
        pdf.set_font(font_family, "", 9.5)
        pdf.set_text_color(51, 65, 85)
        for vp in value_props[:4]:
            pdf.multi_cell(190, 5.5, txt(f" + {vp}"))

    # 6. Hazır Teklif Özeti
    pitch_text = payload.get("whatsapp_pitch") or payload.get("sales_pitch_whatsapp")
    if pitch_text:
        pdf.ln(5)
        pdf.set_font(font_family, "B", 11.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(190, 8, txt("4. Hazir Teklif Mesaji"), ln=1)
        pdf.set_font(font_family, "", 9.5)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(190, 5.5, txt(pitch_text))

    return bytes(pdf.output())
