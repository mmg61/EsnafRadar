# EsnafRadar

## 1. Proje Özeti (Genel Bakış)

**EsnafRadar**, bir bölgedeki yerel işletmeleri harita üzerinde bulmaya, bu işletmelerin internetteki eksiklerini tespit etmeye ve onlara sunulacak iş tekliflerini tek ekrandan hazırlayıp takip etmeye yarayan bir müşteri keşif ve yönetim platformudur.

Web tasarımcıları, dijital reklam ajansları, sosyal medya uzmanları ve saha satış ekipleri için geliştirilmiştir. Sokak sokak gezerek veya haritada tek tek arama yaparak potansiyel müşteri aramak yerine, seçilen bölgedeki tüm işletmeleri saniyeler içinde listeler ve hangi işletmenin hangi dijital hizmete ihtiyacı olduğunu açıkça gösterir.

### Ne İşe Yarar?

1. **Çevredeki İşletmeleri Haritada Bulur:** Harita üzerinde istediğiniz mahalleyi veya caddeyi seçtiğinizde; restoranlardan kuaförlere, oto servislerinden kliniklere kadar 40'tan fazla sektördeki yerel esnafı tespit eder.
2. **İşletmenin İnternetteki Eksiklerini Çıkarır:** Seçilen bir işletmenin internet sitesi olup olmadığını, varsa sitenin güvenli ve telefona uyumlu çalışıp çalışmadığını, Google aramalarında görünüp görünmediğini ve sosyal medya hesaplarını kontrol eder. İşletmeye 100 üzerinden bir **Fırsat Puanı** verir.
3. **Hazır Teklif Mesajı ve PDF Raporu Üretir:** İşletmenin tespit edilen eksiklerine göre WhatsApp, e-posta, Instagram veya telefon görüşmesinde kullanılabilecek ikna edici teklif metinlerini otomatik yazar. Ayrıca müşteriye sunulabilecek şık bir PDF inceleme raporu indirir.
4. **Esnafa Özel Canlı Örnek Site Taslağı Oluşturur:** İnternet sitesi olmayan bir esnafı ikna etmeyi kolaylaştırmak için; işletmenin kendi adını, sektörünü, adresini ve telefon numarasını içeren örnek bir web sitesi önizlemesini anında hazırlar.
5. **Müşteri Takibi ve Geri Arama Hatırlatıcısı Sunar:** İlgilenilen işletmeleri müşteri listesine kaydetmeyi, yapılan görüşmelerle ilgili tarihli notlar tutmayı ve "Yarın saat 14:00'te tekrar ara" gibi sesli/görsel bildirim veren hatırlatıcılar kurmayı sağlar.

---

## 2. Teknik Mimari ve Sistem Detayları

EsnafRadar, istemci-sunucu (Client-Server) mimarisi üzerine inşa edilmiş, asenkron veri toplama, gerçek zamanlı HTML/DOM ayrıştırma, yapay zeka destekli metin üretimi ve ilişkisel müşteri yönetimini birleştiren çok katmanlı bir B2B yazılım sistemidir.

### 2.1. Teknoloji Yığını

| Katman | Teknoloji ve Kütüphaneler | Teknik Rolü |
| :--- | :--- | :--- |
| **Arka Uç (Backend)** | Python 3.12+, FastAPI, Uvicorn | Asenkron REST API uç noktaları, WebSocket bağlantı yönetimi ve iş mantığı orkestrasyonu. |
| **Ağ ve Veri Kazıma** | HTTPX (Async), BeautifulSoup4 | Paralel harita sorguları, çok sayfalı web sitesi taraması, DOM ayrıştırma ve iletişim verisi çıkarımı. |
| **Veritabanı ve ORM** | SQLite / PostgreSQL uyumlu SQLAlchemy 2.0 | İlişkisel veri modelleme, kullanıcı izolasyonu ve `schema_migrations` tablosu üzerinden sürüm takipli otomatik şema geçiş sistemi. |
| **Yapay Zeka ve Raporlama** | Google GenAI SDK (`gemini-2.5-flash`), FPDF2 | Yapılandırılmış JSON şemalı satış metni üretimi ve Unicode Türkçe font destekli vektörel A4 PDF rapor motoru. |
| **Ön Yüz (Frontend)** | React 19, TypeScript, Vite | Katı tip güvenli (`strict` TypeScript), modüler bileşen mimarisi. |
| **Harita ve Görselleştirme** | Leaflet, React-Leaflet, Tailwind CSS | Coğrafi koordinat izdüşümü, sürüklenebilir vektör işaretçiler ve CSS değişkenleri (`CSS Custom Properties`) tabanlı 4 profilli kalıcı tema motoru. |

---

### 2.2. Çekirdek Modüllerin Teknik İşleyişi

#### A. Coğrafi Keşif ve Harita Tarama Motoru (`services/overpass.py` & `services/brands.py`)
* **Hibrit Sorgu Mimarisi:** Seçilen merkez koordinat (`lat`, `lon`) ve yarıçap (`radius`) değerlerinden coğrafi sınırlayıcı kutu (`Bounding Box - BBox`) hesaplanır. Birincil olarak OpenStreetMap v0.6 `map.json` uç noktası üzerinden düşük gecikmeli ham düğüm/yol (`node`/`way`) verisi çekilir; yedekli olarak 4 farklı Overpass API sunucusuna paralel (`asyncio.gather`) sorgu yönlendirilir.
* **Haversine Mesafe Filtresi ve Önbellekleme:** Dönen coğrafi öğeler küresel Haversine formülü ile metre cinsinden merkez noktaya göre filtrelenir. Aynı bölge için yapılan tekrar sorgular 10 dakikalık (`TTL = 600s`) bellek içi (`in-memory`) BBox önbelleğinden milisaniyeler içinde yanıtlanır.
* **Veri Tekilleştirme ve Normalizasyon:** Aynı işletmeye ait parçalı harita kayıtları normalize edilmiş isim ve kategori anahtarıyla tekilleştirilir. Türkiye telefon numaraları (`+90`, `0090`, `90`, `0`) düzenli ifadelerle (`Regex`) tek bir standart formata (`0XXX XXX XX XX`) dönüştürülür. Kurumsal zincir markalar (`brands.py`) yerel esnaftan otomatik ayrıştırılır.

#### B. Derinleştirilmiş Dijital Varlık Denetçisi (`services/auditor.py`)
* **Otomatik Alan Adı Keşfi:** Harita verisinde web sitesi bulunmayan işletmeler için arama motoru sorgusu ve Türkçe karakterlerden arındırılmış (`slug`) `.com.tr` / `.com` alan adı yoklaması (`HTTP HEAD/GET`) yapılarak kayıt dışı web siteleri otomatik keşfedilir.
* **10 Kriterli Teknik ve SEO Analizi:** Hedef sitenin HTTP durum kodu, yanıt süresi (`ms`), TLS/SSL sertifika geçerliliği, `meta[name="viewport"]` mobil uyumluluk etiketi, `<title>`, `meta[name="description"]`, `<h1>`, Favicon, OpenGraph (`og:*`), `Schema.org` (`application/ld+json`), Google Analytics / GTM, Meta Pixel ve gömülü Google Harita (`iframe`) bileşenleri DOM üzerinden denetlenir.
* **İç Sayfa Tarayıcısı ve İletişim Kazıyıcı:** Ana sayfanın yanı sıra `/iletisim`, `/contact`, `/hakkimizda` alt bağlantıları taranarak sayfa kaynağındaki `mailto:`, `tel:`, `wa.me` bağlantıları, e-posta adresleri ve sosyal medya profilleri (Instagram, Facebook, LinkedIn, YouTube, TikTok, X) ayıklanır.

#### C. Yapay Zeka Teklif Üretici ve Canlı Örnek Site Motoru (`services/pitch_generator.py` & `services/demo_site.py`)
* **Çift Motorlu Teklif Üretimi:** Kullanıcı hesabında tanımlı bir Google Gemini API anahtarı bulunduğunda, işletmenin denetim verileri yapılandırılmış JSON şeması (`response_schema`) ile `gemini-2.5-flash` modeline iletilerek seçilen hitap tonuna (`kurumsal`, `samimi`, `acil`, `danisman`) uygun çok kanallı teklif metinleri üretilir. API anahtarı bulunmadığında deterministik yerel kural motoru devreye girerek kesintisiz çıktı sağlar.
* **Dinamik Tek Sayfa HTML Site Üretici:** İşletmenin sektörü, adı, adresi, çalışma saatleri ve telefon numarası kullanılarak dış bağımlılığı olmayan, mobil uyumlu, XSS temizliği (`html.escape`) uygulanmış bağımsız bir HTML5/CSS3 örnek web sitesi şablonu çalışma zamanında (`runtime`) derlenir.

#### D. İlişkisel Veri Şeması ve CRM (`models.py` & `migrations.py`)
* **`users`:** Kullanıcı kimlik bilgileri, Bcrypt şifre özeti, hesap kilitleme sayaçları, şifre sıfırlama kodları ve kullanıcıya özel izole Gemini API anahtarı.
* **`merchants`:** OSM kimliği, koordinatlar, normalize edilmiş iletişim verileri ve JSON formatında önbelleklenmiş son denetim raporu (`audit_data`).
* **`saved_leads`:** Kullanıcı ile işletme arasındaki CRM kaydı, satış aşaması (`new`, `contacted`, `interested`, `won`, `lost`), fırsat puanı ve geri arama hatırlatıcı alanları (`reminder_at`, `reminder_note`, `reminder_completed`).
* **`lead_notes` & `outreach_logs`:** Müşteri bazlı tarihli görüşme notları ve kanal bazlı iletişim geçmişi kayıtları.
* **`rate_limit_logs` & `schema_migrations`:** Kalıcı istek sınırlama kayıtları ve veritabanı şema sürüm geçmişi.

---

### 2.3. Güvenlik ve Veri Bütünlüğü Standartları

1. **Kimlik Doğrulama ve Kriptografi:** Kullanıcı şifreleri rastgele tuzlanmış (`salted`) **Bcrypt** algoritmasıyla tek yönlü özetlenir. Oturumlar `secrets.token_hex(32)` ile üretilen 256-bit entropili `HS256` JWT anahtarı ile imzalanır. Ardışık 5 hatalı giriş denemesinde hesap 15 dakika süreyle kilitlenir.
2. **Kriptografik Şifre Sıfırlama ve Kalıcı Rate Limiting:** 6 haneli sıfırlama kodları `secrets.randbelow` ile üretilir, sabit zamanlı `secrets.compare_digest` ile doğrulanır ve hiçbir koşulda API yanıtında döndürülmez. Kayıt ve şifre sıfırlama istek sınırları (`RateLimitLog`) veritabanında tutularak sunucu yeniden başlatmalarında dahi korunur.
3. **SSRF (Server-Side Request Forgery) ve TLS Koruması:** Web denetçisi, hedef alan adını çözümleyerek `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (bulut metadata) ve özel IPv6 adreslerine giden tüm doğrudan veya yönlendirmeli (`HTTP 3xx`) istekleri bloklar; tüm dış bağlantılarda SSL sertifika doğrulaması (`verify=True`) zorunludur.
4. **CSV Formül Enjeksiyonu (CSV Injection) Koruması:** Dışa aktarılan müşteri listelerinde `=`, `+`, `-`, `@`, `\t`, `\r` karakterleriyle başlayan tüm hücreler otomatik olarak kaçış karakteriyle (`'`) etkisizleştirilir.
5. **Katı Şema Doğrulaması ve Kullanıcı İzolasyonu:** Tüm API girdileri Pydantic `Literal` ve `Field` uzunluk kısıtlamalarıyla doğrulanır. Her kullanıcının müşteri listesi, notları ve yapay zeka API anahtarı veritabanı düzeyinde kendi oturumuna izole edilmiştir.
