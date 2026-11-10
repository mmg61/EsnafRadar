import html
import re
from typing import Dict, Any, Tuple, List
from urllib.parse import quote
from services.auditor import _normalize_tr_phone


def _resolve_sector_profile(category_text: str) -> Tuple[str, str, str, str, List[Tuple[str, str]]]:
    """
    Sektöre göre (Renk Kodu, Vurgu Rengi, Ana Slogan, Alt Açıklama, 3 Hizmet Kartı) döndürür.
    """
    c = (category_text or "").lower()

    if any(k in c for k in ["restoran", "lokanta", "kafe", "kahve", "fırın", "pastane", "tatlı", "food", "cafe", "restaurant", "bakery", "burger", "dürüm"]):
        return (
            "#d97706",
            "#fef3c7",
            "Günlük Taze Lezzetler ve Sıcak Atmosfer",
            "Özenle seçilen malzemelerle hazırlanan menümüzü keşfedin. Masa rezervasyonu veya paket sipariş için bize hemen ulaşabilirsiniz.",
            [
                ("Günlük Taze Üretim", "Mutfağımızda tüm ürünlerimiz her gün taze ve hijyenik koşullarda hazırlanmaktadır."),
                ("Hızlı Paket Servis", "Sıcak ve özenli paketleme ile siparişlerinizi adresinize hızlıca ulaştırıyoruz."),
                ("Aileye Uygun Mekan", "Ferah oturma alanımız ve güler yüzlü ekibimizle misafirlerimizi ağırlıyoruz."),
            ],
        )

    if any(k in c for k in ["kuaför", "berber", "güzellik", "bakım", "spa", "hair", "beauty", "barber"]):
        return (
            "#db2777",
            "#fce7f3",
            "Profesyonel Saç ve Kişisel Bakım Hizmetleri",
            "Size özel stil danışmanlığı, modern kesim teknikleri ve hijyenik bakım uygulamaları için randevunuzu hemen oluşturun.",
            [
                ("Randevulu Hizmet", "Beklemeden, size ayrılan özel saatte konforlu bakım hizmeti sunuyoruz."),
                ("Uzman Kadro", "Alanında deneyimli ekibimizle yüz ve saç tipinize en uygun uygulamaları yapıyoruz."),
                ("Kaliteli Ürünler", "Cildinize ve saçınıza zarar vermeyen seçkin bakım ürünleri kullanıyoruz."),
            ],
        )

    if any(k in c for k in ["oto", "tamir", "servis", "yıkama", "lastik", "yedek parça", "car", "auto", "tyre"]):
        return (
            "#2563eb",
            "#dbeafe",
            "Güvenilir Oto Bakım, Onarım ve Servis Çözümleri",
            "Aracınızın periyodik bakımı, arıza tespiti ve yedek parça ihtiyaçlarında uzman işçilik ve şeffaf fiyat anlayışıyla yanınızdayız.",
            [
                ("Hızlı Arıza Tespiti", "Deneyimli ustalarımız ve modern ekipmanlarımızla sorunu kısa sürede belirliyoruz."),
                ("Garantili İşçilik", "Yapılan tüm bakım ve onarım işlemlerinde güvenli sürüş standartlarını koruyoruz."),
                ("Şeffaf Bilgilendirme", "İşlem öncesinde yapılacak uygulamaları ve maliyeti net şekilde paylaşıyoruz."),
            ],
        )

    if any(k in c for k in ["eczane", "diş", "klinik", "doktor", "veteriner", "sağlık", "medikal", "optik", "health", "dentist", "pharmacy"]):
        return (
            "#0d9488",
            "#ccfbf1",
            "Sağlığınız İçin Güvenilir ve Uzman Yaklaşım",
            "Modern donanımımız, hijyenik ortamımız ve güler yüzlü uzman ekibimizle sağlığınız için yanınızdayız.",
            [
                ("Kolay Randevu", "Telefon veya WhatsApp üzerinden dakikalar içinde randevu ve bilgi alabilirsiniz."),
                ("Hijyenik ve Modern Ortam", "Tüm süreçlerimiz güncel sağlık ve sterilizasyon standartlarına uygundur."),
                ("Hasta Odaklı İlgi", "İhtiyaçlarınızı dinliyor, size en uygun çözüm sürecini anlaşılır şekilde planlıyoruz."),
            ],
        )

    if any(k in c for k in ["otel", "pansiyon", "apart", "konaklama", "hotel", "turizm"]):
        return (
            "#4f46e5",
            "#e0e7ff",
            "Konforlu, Temiz ve Huzurlu Konaklama Deneyimi",
            "Şehrin merkezinde ev sıcaklığında odalarımız ve 7/24 resepsiyon desteğimizle misafirlerimizi ağırlamaktan mutluluk duyarız.",
            [
                ("Merkezi Konum", "Ulaşım noktalarına ve şehrin önemli merkezlerine kolay erişim imkanı."),
                ("Günlük Oda Temizliği", "Odalarımız her misafirimiz için titizlikle hazırlanır ve havalandırılır."),
                ("Doğrudan Rezervasyon Avantajı", "Aracı komisyonu olmadan telefon veya WhatsApp ile en uygun fiyatı alın."),
            ],
        )

    return (
        "#059669",
        "#d1fae5",
        "Kaliteli Ürün, Güvenilir Esnaf ve Hızlı İletişim",
        "Bölgemizde yıllardır süren tecrübemiz, uygun fiyatlarımız ve müşteri memnuniyeti odaklı hizmetimizle yanınızdayız.",
        [
            ("Güvenilir Hizmet", "Müşteri memnuniyetini her zaman ilk sırada tutan yerel işletme anlayışı."),
            ("Hızlı İletişim", "Ürün ve fiyat bilgisi için WhatsApp veya telefon hattımızdan anında yanıt alın."),
            ("Kolay Ulaşım", "Merkezi konumumuzdaki iş yerimize uğrayabilir veya haritadan yol tarifi alabilirsiniz."),
        ],
    )


def generate_demo_site_html(payload: Dict[str, Any]) -> str:
    raw_name = str(payload.get("merchant_name") or "Yerel İşletme").strip()
    raw_category = str(payload.get("category") or "Yerel İşletme").strip()
    raw_phone = payload.get("phone")
    normalized_phone = (_normalize_tr_phone(str(raw_phone)) or str(raw_phone).strip()) if raw_phone else "0500 000 00 00"
    digits = re.sub(r"\D", "", normalized_phone)
    wa_digits = ("9" + digits) if digits.startswith("0") else (digits if digits.startswith("90") else "90" + digits)

    raw_email = str(payload.get("email") or "").strip()
    raw_address = str(payload.get("address") or "").strip()
    if not raw_address or raw_address == "Adres detayı belirtilmemiş":
        raw_address = "Merkez Mahallesi, İşletme Sokak No:1 (Haritadan Yol Tarifi Alabilirsiniz)"

    raw_hours = str(payload.get("opening_hours") or "").strip() or "Pazartesi - Cumartesi: 09:00 - 20:00"
    raw_insta = str(payload.get("instagram") or "").strip()

    lat = payload.get("latitude")
    lon = payload.get("longitude")
    if lat and lon:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
    else:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(raw_name + ' ' + raw_address)}"

    wa_msg = quote(f"Merhaba {raw_name}, web siteniz üzerinden bilgi almak için yazıyorum.")
    wa_url = f"https://wa.me/{wa_digits}?text={wa_msg}"
    tel_url = f"tel:{normalized_phone.replace(' ', '')}"

    primary, light_bg, hero_title, hero_sub, services = _resolve_sector_profile(raw_category)

    name_esc = html.escape(raw_name)
    cat_esc = html.escape(raw_category)
    phone_esc = html.escape(normalized_phone)
    email_esc = html.escape(raw_email)
    addr_esc = html.escape(raw_address)
    hours_esc = html.escape(raw_hours)

    service_cards_html = ""
    for idx, (s_title, s_desc) in enumerate(services, start=1):
        service_cards_html += f"""
        <div class="card">
          <div class="card-num">0{idx}</div>
          <h3>{html.escape(s_title)}</h3>
          <p>{html.escape(s_desc)}</p>
        </div>
        """

    email_row_html = (
        f'<div class="info-item"><strong>E-posta:</strong> <a href="mailto:{email_esc}">{email_esc}</a></div>'
        if raw_email
        else ""
    )

    insta_clean = raw_insta.replace("https://instagram.com/", "").replace("https://www.instagram.com/", "").strip("/@ ")
    insta_url = raw_insta if raw_insta.startswith("http") else f"https://instagram.com/{insta_clean}"
    insta_row_html = (
        f'<div class="info-item"><strong>Instagram:</strong> <a href="{html.escape(insta_url)}" target="_blank" rel="noreferrer">@{html.escape(insta_clean or raw_name)}</a></div>'
        if raw_insta
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{name_esc} | {cat_esc}</title>
  <meta name="description" content="{name_esc} - {html.escape(hero_title)}. İletişim: {phone_esc}" />
  <style>
    :root {{
      --primary: {primary};
      --primary-light: {light_bg};
      --dark: #0f172a;
      --slate: #475569;
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--dark);
      line-height: 1.6;
    }}
    .demo-banner {{
      background: #0f172a;
      color: #e2e8f0;
      text-align: center;
      padding: 8px 16px;
      font-size: 12px;
      border-bottom: 2px solid var(--primary);
    }}
    .demo-banner strong {{ color: #34d399; }}
    header {{
      background: var(--card);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
    }}
    .container {{
      max-width: 1080px;
      margin: 0 auto;
      padding: 0 20px;
    }}
    .nav {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0;
      gap: 12px;
      flex-wrap: wrap;
    }}
    .brand {{
      display: flex;
      flex-direction: column;
    }}
    .brand-name {{
      font-size: 20px;
      font-weight: 800;
      color: var(--dark);
      letter-spacing: -0.3px;
    }}
    .brand-cat {{
      font-size: 12px;
      color: var(--primary);
      font-weight: 600;
    }}
    .nav-actions {{
      display: flex;
      gap: 10px;
      align-items: center;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }}
    .btn:hover {{ transform: translateY(-1px); opacity: 0.95; }}
    .btn-primary {{
      background: var(--primary);
      color: #ffffff;
    }}
    .btn-wa {{
      background: #16a34a;
      color: #ffffff;
    }}
    .btn-outline {{
      background: #ffffff;
      color: var(--dark);
      border: 1px solid var(--border);
    }}
    .hero {{
      padding: 64px 0 56px;
      background: linear-gradient(180deg, var(--primary-light) 0%, var(--bg) 100%);
      border-bottom: 1px solid var(--border);
    }}
    .hero-badge {{
      display: inline-block;
      background: #ffffff;
      color: var(--primary);
      border: 1px solid var(--border);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 16px;
    }}
    .hero h1 {{
      font-size: clamp(28px, 4.5vw, 44px);
      line-height: 1.2;
      font-weight: 800;
      margin-bottom: 16px;
      color: var(--dark);
    }}
    .hero p {{
      font-size: 17px;
      color: var(--slate);
      max-width: 680px;
      margin-bottom: 28px;
    }}
    .hero-cta {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }}
    .section {{
      padding: 56px 0;
    }}
    .section-title {{
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 8px;
    }}
    .section-sub {{
      color: var(--slate);
      font-size: 14px;
      margin-bottom: 28px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
    }}
    .card-num {{
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      color: var(--primary);
      background: var(--primary-light);
      padding: 4px 10px;
      border-radius: 8px;
      margin-bottom: 12px;
    }}
    .card h3 {{
      font-size: 18px;
      margin-bottom: 8px;
    }}
    .card p {{
      color: var(--slate);
      font-size: 14px;
    }}
    .contact-box {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      align-items: center;
    }}
    .info-list {{
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}
    .info-item {{
      font-size: 15px;
      color: var(--slate);
    }}
    .info-item strong {{
      color: var(--dark);
      display: inline-block;
      min-width: 120px;
    }}
    .info-item a {{
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }}
    .map-card {{
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
    }}
    .map-card h4 {{
      font-size: 16px;
      margin-bottom: 8px;
    }}
    .map-card p {{
      font-size: 13px;
      color: var(--slate);
      margin-bottom: 16px;
    }}
    footer {{
      background: var(--dark);
      color: #94a3b8;
      text-align: center;
      padding: 28px 20px;
      font-size: 13px;
      margin-top: 20px;
    }}
    .float-wa {{
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #16a34a;
      color: #fff;
      padding: 12px 18px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none;
      box-shadow: 0 8px 24px rgba(22, 163, 74, 0.35);
      z-index: 99;
    }}
  </style>
</head>
<body>
  <div class="demo-banner">
    Bu sayfa <strong>{name_esc}</strong> için hazırlanmış <strong>Örnek Web Sitesi Taslağıdır</strong>. Telefon ve bilgisayar uyumludur.
  </div>

  <header>
    <div class="container nav">
      <div class="brand">
        <span class="brand-name">{name_esc}</span>
        <span class="brand-cat">{cat_esc}</span>
      </div>
      <div class="nav-actions">
        <a href="{tel_url}" class="btn btn-outline">Ara: {phone_esc}</a>
        <a href="{wa_url}" target="_blank" rel="noreferrer" class="btn btn-wa">WhatsApp İletişim</a>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <span class="hero-badge">{cat_esc} • Resmi Tanıtım Sayfası</span>
      <h1>{name_esc}<br />{html.escape(hero_title)}</h1>
      <p>{html.escape(hero_sub)}</p>
      <div class="hero-cta">
        <a href="{wa_url}" target="_blank" rel="noreferrer" class="btn btn-wa">WhatsApp'tan Bilgi / Randevu Al</a>
        <a href="{tel_url}" class="btn btn-primary">Hemen Ara ({phone_esc})</a>
        <a href="{maps_url}" target="_blank" rel="noreferrer" class="btn btn-outline">Haritada Yol Tarifi Al</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <h2 class="section-title">Neden {name_esc}?</h2>
      <p class="section-sub">Müşterilerimize sunduğumuz başlıca hizmet ve ayrıcalıklar</p>
      <div class="grid">
        {service_cards_html}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top: 0;">
    <div class="container">
      <h2 class="section-title">İletişim ve Ulaşım Bilgileri</h2>
      <p class="section-sub">Bize aşağıdaki kanallardan doğrudan ulaşabilir veya iş yerimizi ziyaret edebilirsiniz.</p>
      <div class="contact-box">
        <div class="info-list">
          <div class="info-item"><strong>İşletme Adı:</strong> {name_esc}</div>
          <div class="info-item"><strong>Sektör:</strong> {cat_esc}</div>
          <div class="info-item"><strong>Telefon:</strong> <a href="{tel_url}">{phone_esc}</a></div>
          {email_row_html}
          {insta_row_html}
          <div class="info-item"><strong>Çalışma Saatleri:</strong> {hours_esc}</div>
          <div class="info-item"><strong>Adres:</strong> {addr_esc}</div>
        </div>
        <div class="map-card">
          <h4>Konum ve Yol Tarifi</h4>
          <p>{addr_esc}</p>
          <a href="{maps_url}" target="_blank" rel="noreferrer" class="btn btn-primary">Google Haritalar'da Aç</a>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      &copy; 2026 <strong>{name_esc}</strong> — Tüm Hakları Saklıdır.
    </div>
  </footer>

  <a href="{wa_url}" target="_blank" rel="noreferrer" class="float-wa">WhatsApp ile Yazın</a>
</body>
</html>"""
