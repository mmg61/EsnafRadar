# 📡 EsnafRadar — Ana Proje Planı (Master Blueprint)

> **Proje Türü:** Yerel B2B İşletme İstihbaratı, Dijital Röntgen ve Lead Yönetim Platformu (SaaS)  
> **Temel Amaç:** Kullanıcıların çevrelerindeki yerel esnafları harita üzerinde keşfetmesini, esnafların dijital varlık ve eksikliklerini otomatik analiz etmesini, potansiyel müşterileri kaydedip notlar alabilmesini ve AI veya manuel şablonlarla doğrudan WhatsApp / E-posta üzerinden iletişime geçebilmesini sağlamak.

---

## 1. 🏗️ Sistem Mimarisi & Teknoloji Yığını

### Teknoloji Bileşenleri ve Gerekçeleri

| Katman | Seçilen Teknoloji | Neden Seçildi? |
| :--- | :--- | :--- |
| **Backend** | **Python (FastAPI)** | Ücretsiz veri kazıma (`httpx`, `BeautifulSoup`), yüksek hızlı asenkron kontroller (`asyncio`), resmi Gemini SDK'sı ve Pydantic veri doğrulama. |
| **Frontend** | **React (Vite) + TypeScript** | Hızlı HMR geliştirme, modüler bileşen mimarisi ve tip güvenliği. |
| **Stil & Animasyon** | **Tailwind CSS + Framer Motion** | Gerçekçi dönen neon radar taraması, yumuşak kademeli kart geçişleri, modern buzlu cam (glassmorphism) karanlık tema. |
| **Harita** | **Leaflet (React-Leaflet)** | Açık kaynak, API anahtarı gerektirmeyen, ücretsiz OpenStreetMap katmanları ve özel animasyonlu pinler. |
| **Veritabanı** | **SQLite (SQLAlchemy / Alembic)** | Sıfır kurulum, geliştirme kolaylığı, sonradan tek bir ayarla PostgreSQL'e taşınabilir mimari. |
| **Yapay Zekâ** | **Google Gemini 2.5 / 1.5 Flash** | Düşük gecikme süresi, ücretsiz/çok düşük maliyet, JSON şemalı yapılandırılmış karne ve akıllı mesaj taslakları. |

---

## 2. 🗄️ Veritabanı Şeması

* **USERS:** id, email, hashed_password, full_name, created_at
* **MERCHANTS:** osm_id, name, latitude, longitude, category, phone, email, website, address, audit_data (JSON), last_scanned_at
* **SAVED_LEADS:** id, user_id (FK), merchant_id (FK), status, opportunity_score, saved_at
* **LEAD_NOTES:** id, saved_lead_id (FK), user_id (FK), content, created_at, updated_at
* **OUTREACH_LOGS:** id, saved_lead_id (FK), channel (WhatsApp/Email), message_content, is_ai_generated, sent_at
* **SCAN_HISTORY:** id, user_id (FK), search_lat, search_lng, radius_meters, category_filter, results_count, created_at

---

## 3. 🧩 Temel Modüller

1. **Kullanıcı Yönetimi (Auth):** JWT + Bcrypt ile güvenli çoklu kullanıcı.
2. **Ücretsiz Keşif Motoru (Discovery):** OpenStreetMap Overpass API ile koordinat ve yarıçapa göre yerel esnaf tespiti.
3. **Dijital Sağlık Denetçisi (Auditor):** Web sitesi var mı? SSL geçerli mi? Mobil uyumlu mu? İletişim bilgileri neler?
4. **Gemini Zekâ & Fırsat Puanlama Motoru:** Eksiklik karnesi ve 1-100 fırsat skoru.
5. **İletişim & Mesajlaşma Dağıtıcısı (Outreach):** Manuel / AI destekli WhatsApp (`wa.me`) ve e-posta tetikleyicisi.
6. **Kişisel Lead CRM & Not Defteri:** Esnafı kaydetme, tarihli notlar tutma ve müşteri yaşam döngüsü takibi.
