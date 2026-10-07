# 📡 EsnafRadar — Proje Kalıcı Hafızası & Çalışma Kuralları

> **ÖNEMLİ (TÜM SOHBETLER İÇİN):** Bu dosya projenin kalıcı hafızasıdır. Yeni bir sohbet oturumu açılsa dahi bu projenin tüm bağlamı, geçmiş kararları ve mimarisi bu belgeden okunmalı; kullanıcıya asla projeyi baştan anlatıyormuş gibi davranılmamalıdır.

---

## 🧠 1. Proje Kimliği & Temel Vizyon
* **Proje Adı:** EsnafRadar
* **Proje Türü:** Yerel B2B İşletme İstihbaratı, Dijital Röntgen ve Lead Yönetim Platformu (SaaS).
* **Bizim Rolümüz:** Biz son esnafa bir hizmet satmıyoruz. Sistem üzerinden yerel esnafların tüm dijital eksikliklerini ve iletişim verilerini tarafsızca analiz edip kullanıcımıza sunuyoruz. Kullanıcı (freelancer, ajans, satış temsilcisi) bu istihbaratla kendi dilediği hizmeti esnafa sunar.
* **Ana Değer Önerisi:** Ücretsiz harita verisi ile esnafları keşfetmek, web/sosyal varlıklarını otomatik denetlemek, potansiyel müşterileri kaydetmek, notlar tutmak ve tek tıkla (WhatsApp/E-posta) kişiselleştirilmiş AI mesajları ile iletişime geçmek.

---

## 🛠️ 2. Onaylanmış Teknik Mimari ve Kararlar

| Katman | Teknoloji | Seçim Gerekçesi / Karar |
| :--- | :--- | :--- |
| **Backend** | **Python (FastAPI)** | Asenkron ağ denetimleri (`httpx`), ücretsiz veri kazıma (`BeautifulSoup`), Gemini resmi SDK'sı (`google-genai`) ve JWT auth. |
| **Frontend** | **React (Vite) + TypeScript** | Yüksek geliştirme hızı, tip güvenliği ve zengin bileşen desteği. |
| **Tasarım & Animasyon** | **Tailwind CSS + Framer Motion** | Neon radar sonar animasyonu, cam efektli (glassmorphism) karanlık tema, kademeli esnaf kartları. |
| **Harita Servisi** | **Leaflet (React-Leaflet)** | **API keysiz ve ücretsiz**. OpenStreetMap ve Overpass API ile sınırsız yerel esnaf tarama. |
| **Yapay Zekâ** | **Google Gemini 2.5 / 1.5 Flash** | Hızlı, düşük maliyetli, esnaf eksikliklerini JSON olarak puanlama ve dinamik WhatsApp/satış mesajı üretme. |
| **Veritabanı** | **SQLite (SQLAlchemy)** | Kurulumsuz, yerel, hızlı. İleride PostgreSQL'e taşınabilir. |
| **İletişim** | **WhatsApp Web Deeplink & Mailto** | API maliyetsiz; `wa.me` ile tek tıkla mesaj dolu WhatsApp penceresi açma. |

---

## 👤 3. Kullanıcı Yetenekleri (Kazanımlar)
1. **Giriş / Kayıt:** JWT ve Bcrypt tabanlı çok kullanıcılı sistem. Her kullanıcı yalnızca kendi taramalarını ve listelerini görür.
2. **Esnaf Radarı:** Konum ve yarıçapa göre esnafları haritada radar dalgasıyla tarama.
3. **Dijital Röntgen:** Web sitesi var mı? SSL geçerli mi? Mobil uyumlu mu? İletişim bilgileri neler?
4. **Esnafı Kaydetme (Bookmark):** İlgilendiği esnafı "Kişisel Lead Listesi"ne kaydetme.
5. **Özel Notlar:** Her esnafa özel tarihli zengin notlar alma ve güncelleme.
6. **AI Destekli / Manuel Mesajlaşma:** Esnafın eksikliklerine göre Gemini ile otomatik veya manuel mesaj oluşturup tek tıkla WhatsApp Web'e aktarma.

---

## 📌 4. Yol Haritası ve Mevcut Durum

- [x] **Aşama 1: Konsept ve Mimari:** Rol tanımlandı (B2B İstihbarat), teknik yığın seçildi.
- [x] **Aşama 2: Ana Proje Planı:** `PROJECT_PLAN.md` ve veritabanı şeması hazırlandı.
- [x] **Aşama 3: Kalıcı Hafıza Sistemi:** Bu dosya (`GEMINI.md`) ile tüm sohbetler arası kalıcı hafıza kuruldu.
- [ ] **Aşama 4: Tasarım & Çözüm Planı:** Arayüz alternatifleri, ekran yerleşimleri ve çözümlerin netleştirilmesi (👉 **ŞU AN BURADAYIZ**).
- [ ] **Aşama 5: Backend Geliştirme:** Overpass API entegrasyonu, web auditor, Gemini entegrasyonu, Auth & DB.
- [ ] **Aşama 6: Frontend Geliştirme:** React + Vite + Tailwind + Framer Motion Radar ve Leaflet.
- [ ] **Aşama 7: Test & Canlıya Alma.**

---

## 🤖 5. Agent İçin Davranış Kuralı
Kullanıcı bu projede yeni bir sohbet penceresi açtığında:
1. Asla "Merhaba ne yapıyoruz?" veya "Projeniz nedir?" diye sorma.
2. Doğrudan **EsnafRadar** projesinde olduğunu bil.
3. Kaldığımız son adımı (`Aşama 4: Tasarım & Çözüm Planı`) referans alarak kullanıcının komutunu hemen yerine getir.
