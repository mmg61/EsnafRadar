# EsnafRadar

EsnafRadar, coğrafi konuma dayalı yerel işletme keşfi, dijital varlık denetimi (web sitesi, SSL, mobil uyumluluk, arama motoru görünürlüğü), örnek web sitesi taslağı üretimi ve müşteri ilişkileri yönetimi (CRM) sunan bir B2B istihbarat platformudur.

## Temel Özellikler

1. **Bölgesel Keşif Motoru:** OpenStreetMap v0.6 ve çoklu Overpass API sunucuları üzerinden 40'tan fazla sektör filtresiyle saniyeler içinde yerel işletme taraması.
2. **Dijital Varlık İncelemesi (SSRF Korumalı):** Hedef işletmenin web sitesi, SSL sertifikası, mobil uyumluluğu, SEO etiketleri ve sosyal medya hesaplarının otomatik kontrolü ve 1-100 arası fırsat puanlaması.
3. **Kişiselleştirilmiş Teklif ve PDF Rapor Üretici:** Google Gemini (kullanıcıya özel API anahtarı izolasyonu) veya yerel kural motoru ile WhatsApp, E-posta, Instagram DM ve telefon görüşme metinleri; tek tıkla A4 PDF inceleme raporu indirme.
4. **Canlı Örnek Site Önizlemesi:** Web sitesi olmayan işletmeler için işletmenin kendi adı, sektörü, telefonu ve adresiyle anında çalışan tek sayfalık HTML site taslağı üretimi.
5. **Müşteri İlişkileri Yönetimi (CRM) ve Geri Arama Hatırlatıcısı:** Müşteri adaylarını kaydetme, aşama takibi, tarihli görüşme notları, geri arama hatırlatıcısı ve formül enjeksiyonuna karşı korumalı CSV/Excel dışa aktarımı.

## Hızlı Başlangıç (Windows Masaüstü)

Proje kök dizinindeki `baslat.bat` dosyasına çift tıklayın. Arka uç (`127.0.0.1:8000`) ve ön yüz (`127.0.0.1:5173`) sunucuları arka planda penceresiz olarak başlatılır ve tarayıcı otomatik açılır. Tarayıcı sekmesi kapatıldığında sunucular otomatik olarak kapanır.

## Manuel Kurulum ve Çalıştırma

### 1. Ortam Değişkenleri
`.env.example` dosyasını `backend/.env` olarak kopyalayın ve gerekli değişkenleri düzenleyin (`JWT_SECRET_KEY` boş bırakılırsa ilk açılışta kriptografik olarak otomatik üretilir).

### 2. Arka Uç (Backend - FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Ön Yüz (Frontend - React + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```

## Testleri Çalıştırma

```bash
cd backend
venv\Scripts\python.exe -m pytest tests/test_security_and_api.py -v
```
