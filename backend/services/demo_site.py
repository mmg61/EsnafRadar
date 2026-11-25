import html
import re
from typing import Dict, Any, Tuple, List
from urllib.parse import quote
from services.auditor import _normalize_tr_phone


def _resolve_sector_profile(category_text: str) -> Tuple[str, str, str, str, List[Tuple[str, str]]]:
    """
    Sektöre göre göz yormayan, sakin ve kurumsal:
    (Ana Vurgu Rengi, Yumuşak Yüzey Rengi, Kısa Başlık, Kısa Alt Metin, 3 Sade Hizmet Kartı) döndürür.
    """
    c = (category_text or "").lower()

    if any(k in c for k in ["restoran", "lokanta", "kafe", "kahve", "fırın", "pastane", "tatlı", "food", "cafe", "restaurant", "bakery", "burger", "dürüm", "pide", "kebap"]):
        return (
            "#854d0e",
            "#f5f2eb",
            "Özenli Mutfak, Günlük Taze Lezzetler",
            "Kaliteli malzemelerle hazırlanan menümüz, samimi ortamımız ve hızlı servisimizle hizmetinizdeyiz.",
            [
                ("Günlük Hazırlık", "Tüm ürünlerimiz her sabah taze malzemelerle özenle hazırlanır."),
                ("Mekan ve Paket Servis", "İster yerinde keyifle tüketin, ister sıcak paket sipariş verin."),
                ("Kolay Rezervasyon", "Grup yemekleri ve özel günler için telefonla yerinizi ayırtın."),
            ],
        )

    if any(k in c for k in ["kuaför", "berber", "güzellik", "bakım", "spa", "hair", "beauty", "barber"]):
        return (
            "#5b3e5c",
            "#f4eff4",
            "Kişiye Özel Saç ve Bakım Uygulamaları",
            "Hijyenik ortamda, yüz ve saç yapınıza uygun modern kesim ve bakım hizmetleri sunuyoruz.",
            [
                ("Planlı Randevu", "Beklemeden, size ayrılan saatte sakin ve özenli hizmet alın."),
                ("Deneyimli Ekip", "Stilinize en uygun kesim ve bakım uygulamalarını birlikte belirliyoruz."),
                ("Seçkin Ürünler", "Saç ve cilt sağlığını koruyan güvenilir ürünlerle çalışıyoruz."),
            ],
        )

    if any(k in c for k in ["oto", "tamir", "servis", "yıkama", "lastik", "yedek parça", "car", "auto", "tyre"]):
        return (
            "#1e3a5f",
            "#eef2f6",
            "Güvenilir Oto Bakım ve Servis Hizmeti",
            "Aracınızın bakım, onarım ve kontrol işlemlerinde şeffaf bilgilendirme ve titiz işçilik sunuyoruz.",
            [
                ("Doğru Arıza Tespiti", "Sorunu hızlıca belirleyip işlem öncesi net bilgi paylaşıyoruz."),
                ("Titiz İşçilik", "Aracınızın güvenliği için standartlara uygun bakım uyguluyoruz."),
                ("Zamanında Teslim", "Planlanan sürede işlemleri tamamlayarak aracınızı teslim ediyoruz."),
            ],
        )

    if any(k in c for k in ["eczane", "diş", "klinik", "doktor", "veteriner", "sağlık", "medikal", "optik", "health", "dentist", "pharmacy"]):
        return (
            "#1f5c58",
            "#edf4f3",
            "Uzman Kadro ve Güvenilir Sağlık Yaklaşımı",
            "Modern donanımımız ve steril çalışma düzenimizle ihtiyaçlarınıza özenli çözümler üretiyoruz.",
            [
                ("Hızlı Bilgilendirme", "Telefon veya mesaj yoluyla kolayca bilgi ve randevu alabilirsiniz."),
                ("Steril Ortam", "Tüm süreçlerimiz güncel hijyen kurallarına titizlikle uygun yürütülür."),
                ("Birebir İlgi", "Sürecin her adımını anlaşılır ve şeffaf biçimde sizinle paylaşıyoruz."),
            ],
        )

    if any(k in c for k in ["otel", "pansiyon", "apart", "konaklama", "hotel", "turizm"]):
        return (
            "#37474f",
            "#eef1f2",
            "Sakin, Temiz ve Konforlu Konaklama",
            "Merkezi konumda, özenle hazırlanmış odalarımızla huzurlu bir konaklama deneyimi sunuyoruz.",
            [
                ("Merkezi Ulaşım", "Şehrin ana noktalarına ve toplu ulaşıma yakın konum."),
                ("Özenli Temizlik", "Odalarımız her konaklama öncesi detaylı olarak hazırlanır."),
                ("Doğrudan İletişim", "Aracısız bilgi ve rezervasyon için bize doğrudan ulaşabilirsiniz."),
            ],
        )

    return (
        "#27364b",
        "#eff2f5",
        "Güvenilir Hizmet ve Doğrudan İletişim",
        "Bölgemizdeki tecrübemiz, dürüst esnaflık anlayışımız ve ulaşılabilir ekibimizle yanınızdayız.",
        [
            ("Kaliteli Hizmet", "Müşteri memnuniyetini esas alan özenli ve temiz çalışma düzeni."),
            ("Doğrudan İletişim", "Sorularınız ve talepleriniz için bize tek tıkla ulaşabilirsiniz."),
            ("Kolay Ulaşım", "Harita konumu üzerinden iş yerimize zahmetsizce yol tarifi alın."),
        ],
    )


def generate_demo_site_html(payload: Dict[str, Any]) -> str:
    raw_name = str(payload.get("merchant_name") or "Yerel İşletme").strip()
    raw_category = str(payload.get("category") or "Yerel İşletme").strip()
    raw_phone = payload.get("phone")
    has_real_phone = bool(raw_phone and str(raw_phone).strip())
    normalized_phone = (_normalize_tr_phone(str(raw_phone)) or str(raw_phone).strip()) if has_real_phone else ""
    digits = re.sub(r"\D", "", normalized_phone)
    wa_digits = ("9" + digits) if digits.startswith("0") else (digits if digits.startswith("90") else ("90" + digits if digits else ""))

    raw_email = str(payload.get("email") or "").strip()
    raw_address = str(payload.get("address") or "").strip()
    if not raw_address or raw_address == "Adres detayı belirtilmemiş":
        display_address = "Harita üzerinden tam konumu görüntüleyebilirsiniz."
    else:
        display_address = raw_address

    raw_hours = str(payload.get("opening_hours") or "").strip() or "Pazartesi – Cumartesi • 09:00 – 20:00"
    raw_insta = str(payload.get("instagram") or "").strip()

    lat = payload.get("latitude")
    lon = payload.get("longitude")
    if lat and lon:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
    else:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(raw_name + ' ' + raw_address)}"

    wa_msg = quote(f"Merhaba {raw_name}, bilgi almak için yazıyorum.")
    wa_url = f"https://wa.me/{wa_digits}?text={wa_msg}" if wa_digits else "#iletisim"
    tel_url = f"tel:{normalized_phone.replace(' ', '')}" if normalized_phone else "#iletisim"

    accent, accent_soft, hero_title, hero_sub, services = _resolve_sector_profile(raw_category)

    name_esc = html.escape(raw_name)
    initial_esc = html.escape((raw_name[0] if raw_name else "İ").upper())
    cat_esc = html.escape(raw_category)
    phone_esc = html.escape(normalized_phone) if normalized_phone else "Telefon bilgisi eklenecek"
    email_esc = html.escape(raw_email)
    addr_esc = html.escape(display_address)
    hours_esc = html.escape(raw_hours)

    service_cards_html = ""
    for s_title, s_desc in services:
        service_cards_html += f"""
        <div class="service-card">
          <div class="service-dot"></div>
          <h3>{html.escape(s_title)}</h3>
          <p>{html.escape(s_desc)}</p>
        </div>
        """

    primary_cta_html = (
        f'<a href="{wa_url}" target="_blank" rel="noreferrer" class="btn btn-solid">İletişime Geç</a>'
        if wa_digits
        else '<a href="#iletisim" class="btn btn-solid">İletişim Bilgileri</a>'
    )

    header_cta_html = (
        f'<a href="{tel_url}" class="nav-cta">{phone_esc}</a>'
        if normalized_phone
        else '<a href="#iletisim" class="nav-cta">Bize Ulaşın</a>'
    )

    extra_links_html = ""
    if raw_email:
        extra_links_html += f'<div class="meta-row"><span class="meta-label">E-posta</span><a href="mailto:{email_esc}" class="meta-val link">{email_esc}</a></div>'
    if raw_insta:
        insta_clean = raw_insta.replace("https://instagram.com/", "").replace("https://www.instagram.com/", "").strip("/@ ")
        insta_url = raw_insta if raw_insta.startswith("http") else f"https://instagram.com/{insta_clean}"
        extra_links_html += f'<div class="meta-row"><span class="meta-label">Instagram</span><a href="{html.escape(insta_url)}" target="_blank" rel="noreferrer" class="meta-val link">@{html.escape(insta_clean or raw_name)}</a></div>'

    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{name_esc} — {cat_esc}</title>
  <meta name="description" content="{name_esc} - {html.escape(hero_title)}" />
  <style>
    :root {{
      --canvas: #f6f5f2;
      --surface: #ffffff;
      --subtle: {accent_soft};
      --ink: #1c1917;
      --muted: #57534e;
      --soft: #78716c;
      --border: #e7e5e0;
      --accent: {accent};
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--canvas);
      color: var(--ink);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }}
    .wrap {{
      max-width: 980px;
      margin: 0 auto;
      padding: 0 24px;
    }}

    /* Üst Menü */
    header {{
      background: rgba(246, 245, 242, 0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 20;
    }}
    .topbar {{
      height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }}
    .monogram {{
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--accent);
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }}
    .brand-title {{
      font-size: 16px;
      font-weight: 650;
      color: var(--ink);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    .nav-right {{
      display: flex;
      align-items: center;
      gap: 20px;
      flex-shrink: 0;
    }}
    .nav-link {{
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      font-weight: 500;
    }}
    .nav-link:hover {{ color: var(--ink); }}
    .nav-cta {{
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 10px;
      text-decoration: none;
      transition: background 0.15s ease;
    }}
    .nav-cta:hover {{ background: var(--subtle); }}

    /* Ana Karşılama Kartı */
    .hero-section {{
      padding: 36px 0 28px;
    }}
    .hero-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 44px;
      display: grid;
      grid-template-columns: 1.25fr 0.85fr;
      gap: 36px;
      align-items: center;
    }}
    .eyebrow {{
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      background: var(--subtle);
      padding: 5px 12px;
      border-radius: 999px;
      margin-bottom: 18px;
    }}
    .hero-card h1 {{
      font-size: clamp(24px, 3.2vw, 34px);
      line-height: 1.25;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--ink);
      margin-bottom: 14px;
    }}
    .hero-lead {{
      font-size: 15px;
      color: var(--muted);
      max-width: 460px;
      margin-bottom: 26px;
    }}
    .actions {{
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 11px 20px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }}
    .btn:hover {{ opacity: 0.9; }}
    .btn-solid {{
      background: var(--accent);
      color: #ffffff;
    }}
    .btn-ghost {{
      background: var(--canvas);
      color: var(--ink);
      border: 1px solid var(--border);
    }}

    /* Sağ Özet Kutusu */
    .summary-panel {{
      background: var(--canvas);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }}
    .summary-item {{
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }}
    .summary-item:last-child {{
      padding-bottom: 0;
      border-bottom: none;
    }}
    .summary-label {{
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--soft);
      font-weight: 600;
    }}
    .summary-value {{
      font-size: 13.5px;
      color: var(--ink);
      font-weight: 550;
    }}

    /* Hizmetler */
    .services-section {{
      padding: 16px 0 28px;
    }}
    .section-head {{
      margin-bottom: 18px;
    }}
    .section-head h2 {{
      font-size: 18px;
      font-weight: 650;
      letter-spacing: -0.015em;
      color: var(--ink);
    }}
    .services-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }}
    .service-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 24px;
    }}
    .service-dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      margin-bottom: 14px;
    }}
    .service-card h3 {{
      font-size: 15px;
      font-weight: 650;
      margin-bottom: 6px;
      color: var(--ink);
    }}
    .service-card p {{
      font-size: 13.5px;
      color: var(--muted);
      line-height: 1.55;
    }}

    /* İletişim Bölümü */
    .contact-section {{
      padding: 8px 0 40px;
    }}
    .contact-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }}
    .meta-grid {{
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}
    .meta-row {{
      display: flex;
      gap: 12px;
      font-size: 13.5px;
      flex-wrap: wrap;
    }}
    .meta-label {{
      color: var(--soft);
      min-width: 110px;
      font-weight: 500;
    }}
    .meta-val {{
      color: var(--ink);
      font-weight: 550;
    }}
    .meta-val.link {{
      color: var(--accent);
      text-decoration: none;
    }}

    footer {{
      border-top: 1px solid var(--border);
      padding: 20px 0 28px;
      font-size: 12px;
      color: var(--soft);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }}

    @media (max-width: 760px) {{
      .nav-link {{ display: none; }}
      .hero-card {{
        grid-template-columns: 1fr;
        padding: 28px 22px;
        gap: 24px;
      }}
      .services-grid {{
        grid-template-columns: 1fr;
      }}
      .contact-card {{
        padding: 22px;
      }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="wrap topbar">
      <div class="brand">
        <div class="monogram">{initial_esc}</div>
        <span class="brand-title">{name_esc}</span>
      </div>
      <div class="nav-right">
        <a href="#hizmetler" class="nav-link">Hizmetler</a>
        <a href="#iletisim" class="nav-link">İletişim</a>
        {header_cta_html}
      </div>
    </div>
  </header>

  <main class="wrap">
    <section class="hero-section">
      <div class="hero-card">
        <div>
          <span class="eyebrow">{cat_esc}</span>
          <h1>{html.escape(hero_title)}</h1>
          <p class="hero-lead">{html.escape(hero_sub)}</p>
          <div class="actions">
            {primary_cta_html}
            <a href="{maps_url}" target="_blank" rel="noreferrer" class="btn btn-ghost">Haritada Yol Tarifi</a>
          </div>
        </div>

        <div class="summary-panel">
          <div class="summary-item">
            <span class="summary-label">Çalışma Saatleri</span>
            <span class="summary-value">{hours_esc}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Telefon</span>
            <span class="summary-value">{phone_esc}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Konum</span>
            <span class="summary-value">{addr_esc}</span>
          </div>
        </div>
      </div>
    </section>

    <section id="hizmetler" class="services-section">
      <div class="section-head">
        <h2>Hizmet Anlayışımız</h2>
      </div>
      <div class="services-grid">
        {service_cards_html}
      </div>
    </section>

    <section id="iletisim" class="contact-section">
      <div class="contact-card">
        <div class="meta-grid">
          <div class="meta-row">
            <span class="meta-label">İşletme</span>
            <span class="meta-val">{name_esc}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Telefon</span>
            <span class="meta-val">{phone_esc}</span>
          </div>
          {extra_links_html}
          <div class="meta-row">
            <span class="meta-label">Adres</span>
            <span class="meta-val">{addr_esc}</span>
          </div>
        </div>

        <a href="{maps_url}" target="_blank" rel="noreferrer" class="btn btn-ghost">Haritada Aç</a>
      </div>
    </section>

    <footer>
      <span>© 2026 {name_esc}</span>
      <span>{cat_esc}</span>
    </footer>
  </main>
</body>
</html>
"""
