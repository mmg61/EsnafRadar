import re
from typing import Optional
from bs4 import BeautifulSoup


def _tr_lower(text: str) -> str:
    return (text or "").replace("İ", "i").replace("I", "ı").lower().strip()


# 26 Hassas Sektör Kategorisi:
# Her kategori için (çekirdek_kelimeler [ağırlık x2], destekleyici_kelimeler [ağırlık x1]) tanımlanır.
# Tüm kelimeler Türkçe küçük harf korunarak kelime sınırı (\b) ile aranır; böylece "diş" ile "dışında",
# "oto" ile "otomatik/fotoğraf" gibi alt-dize çakışmaları kesin olarak engellenir.
CATEGORY_KEYWORDS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "food": (
        (
            "restoran", "restaurant", "lokanta", "kafe", "cafe", "kahve", "coffee",
            "fırın", "unlu mamul", "pastane", "patisserie", "kebap", "pide", "lahmacun",
            "döner", "burger", "pizza", "köfte", "dondurma", "tatlı", "baklava", "bistro",
            "meyhane", "pub", "steakhouse", "şarküteri", "meze",
        ),
        (
            "menü", "menu", "lezzet", "mutfak", "yemek", "kahvaltı", "paket servis",
            "rezervasyon", "afiyet", "şef", "gastronomi", "içecek", "espresso", "tatlılar",
        ),
    ),
    "beauty": (
        (
            "kuaför", "berber", "barber", "hair", "saç tasarım", "güzellik salonu",
            "güzellik merkezi", "cilt bakım", "lazer epilasyon", "epilasyon", "protez tırnak",
            "kalıcı makyaj", "spa", "masaj salonu", "dövme", "tattoo", "piercing",
            "kozmetik", "parfümeri", "parfüm",
        ),
        (
            "saç kesim", "ombre", "sombre", "röfle", "gelin başı", "manikür", "pedikür",
            "kaş", "kirpik", "bakım", "estetik", "masaj", "cilt", "makyaj",
        ),
    ),
    "pharmacy": (
        (
            "eczane", "eczanesi", "pharmacy", "eczacı", "nöbetçi eczane",
        ),
        (
            "reçete", "ilaç", "dermokozmetik", "vitamin", "takviye edici", "medikal ürün",
        ),
    ),
    "dental": (
        (
            "diş kliniği", "diş polikliniği", "diş hekimi", "ağız ve diş", "dental",
            "dentist", "implant", "ortodonti", "endodonti", "pedodonti", "gülüş tasarımı",
        ),
        (
            "zirkonyum", "kanal tedavisi", "diş beyazlatma", "diş taşı", "protez diş", "çene cerrahisi",
        ),
    ),
    "veterinary": (
        (
            "veteriner", "veterinary", "vet klinik", "pet klinik", "hayvan hastanesi",
        ),
        (
            "evcil hayvan", "kedi", "köpek", "aşı takvimi", "kısırlaştırma", "patili", "mikroçip",
        ),
    ),
    "optician": (
        (
            "optik", "gözlükçü", "optician", "güneş gözlüğü", "numaralı gözlük", "kontakt lens",
        ),
        (
            "gözlük", "lens", "çerçeve", "optik cam", "progresif cam",
        ),
    ),
    "medical": (
        (
            "poliklinik", "hastane", "tıp merkezi", "muayenehane", "klinik", "doktor",
            "uzman dr", "op dr", "prof dr", "medikal", "ortopedi", "fizyoterapi",
            "psikolog", "diyetisyen", "işitme cihaz",
        ),
        (
            "hasta", "tedavi", "tanı", "muayene", "hekim", "sağlık", "cerrahi", "check-up",
        ),
    ),
    "auto": (
        (
            "oto tamir", "oto servis", "oto bakım", "otomotiv", "mekanik servis", "kaporta",
            "oto yıkama", "detailing", "oto kuaför", "oto lastik", "lastikçi", "rot balans",
            "oto yedek parça", "yedek parça", "oto galeri", "motosiklet servis", "akaryakıt",
            "benzin istasyonu", "auto service", "car wash",
        ),
        (
            "şanzıman", "motor bakım", "periyodik bakım", "fren", "debriyaj", "egzoz",
            "pasta cila", "seramik kaplama", "jant", "akü", "ikinci el araç", "ekspertiz", "oto",
        ),
    ),
    "real_estate": (
        (
            "emlak", "gayrimenkul", "real estate", "emlak danışman", "emlak ofisi",
        ),
        (
            "satılık", "kiralık", "daire", "konut", "arsa", "villa", "işyeri", "portföy", "tapu",
        ),
    ),
    "legal": (
        (
            "avukat", "hukuk bürosu", "avukatlık", "hukuk ve danışmanlık", "noter", "noterlik",
            "arabulucu", "law firm", "attorney",
        ),
        (
            "hukuk", "dava", "icra", "ceza hukuku", "ticaret hukuku", "aile hukuku", "müvekkil",
        ),
    ),
    "accounting_insurance": (
        (
            "mali müşavir", "smmm", "ymmm", "muhasebe bürosu", "vergi danışman",
            "sigorta acentesi", "sigorta aracılık", "kasko", "trafik sigortası",
        ),
        (
            "muhasebe", "beyanname", "bilanço", "bordro", "sigorta", "poliçe", "tamamlayıcı sağlık", "dask",
        ),
    ),
    "hospitality_travel": (
        (
            "otel", "hotel", "butik otel", "pansiyon", "apart otel", "hostel", "motel",
            "konaklama", "seyahat acentesi", "turizm acentesi", "tur şirketi",
        ),
        (
            "oda", "suit", "rezervasyon", "check-in", "tatil", "tur", "uçak bileti", "transfer", "vize",
        ),
    ),
    "fitness_sports": (
        (
            "spor salonu", "fitness", "gym", "pilates", "reformer pilates", "crossfit",
            "yoga stüdyo", "dövüş sanatları", "personal trainer",
        ),
        (
            "antrenman", "egzersiz", "kardiyo", "vücut geliştirme", "grup dersleri", "üyelik",
        ),
    ),
    "education": (
        (
            "sürücü kursu", "ehliyet kursu", "dil kursu", "dil okulu", "etüt merkezi",
            "özel öğretim", "eğitim kurumu", "akademi", "kurs merkezi",
        ),
        (
            "direksiyon dersi", "ehliyet", "ingilizce", "almanca", "öğrenci", "sınav hazırlık", "ders",
        ),
    ),
    "grocery_butcher": (
        (
            "süpermarket", "supermarket", "market", "bakkal", "kasap", "et pazarı",
            "şarküteri", "manav", "organik pazar", "kuruyemiş",
        ),
        (
            "dana eti", "kuzu eti", "gıda", "taze meyve", "sebze", "temel gıda", "bakliyat",
        ),
    ),
    "fashion_shoes": (
        (
            "giyim", "butik", "moda evi", "hazır giyim", "tesettür giyim", "abiye",
            "ayakkabı", "çanta mağazası", "boutique",
        ),
        (
            "koleksiyon", "elbise", "gömlek", "pantolon", "ceket", "sneaker", "topuklu", "kombin",
        ),
    ),
    "jewelry": (
        (
            "kuyumcu", "kuyumculuk", "mücevher", "mücevherat", "pırlanta", "sarraf", "saatçi",
        ),
        (
            "altın", "alyans", "tektaş", "bilezik", "kolye", "küpe", "ayar altın", "gümüş",
        ),
    ),
    "tech_electronics": (
        (
            "elektronik mağaza", "cep telefonu", "telefon tamir", "bilgisayar servis",
            "teknoloji mağaza", "beyaz eşya",
        ),
        (
            "akıllı telefon", "ekran değişimi", "batarya", "laptop", "tablet", "aksesuar", "elektronik",
        ),
    ),
    "furniture_home": (
        (
            "mobilya", "koltuk takımı", "yatak odası", "yemek odası", "marangoz",
            "mobilya atölyesi", "ev dekorasyon", "perde", "halı mağaza",
        ),
        (
            "kanepe", "köşe takımı", "gardırop", "ahşap", "özel ölçü dolap", "mutfak dolabı", "dekorasyon",
        ),
    ),
    "hardware": (
        (
            "hırdavat", "nalbur", "nalburiye", "yapı market", "inşaat malzemeleri", "boya bayi",
        ),
        (
            "el aletleri", "vida", "matkap", "tesisat malzeme", "izolasyon", "seramik", "el arabası",
        ),
    ),
    "florist": (
        (
            "çiçekçi", "çiçekçilik", "çiçek evi", "florist", "orkide", "buket",
        ),
        (
            "çiçek sipariş", "aranjman", "çelenk", "kırmızı gül", "teraryum", "saksı çiçeği",
        ),
    ),
    "books_stationery": (
        (
            "kitabevi", "kitapçı", "sahaf", "kırtasiye", "copy center", "fotokopi",
            "dijital baskı", "matbaa", "ozalit",
        ),
        (
            "kitap", "roman", "okul kırtasiye", "defter", "kalem", "ofis malzeme", "davetiye", "kartvizit",
        ),
    ),
    "petshop": (
        (
            "petshop", "pet shop", "akvaryum", "evcil hayvan ürünleri",
        ),
        (
            "kedi maması", "köpek maması", "kuş yemi", "kedi kumu", "tasma", "mama",
        ),
    ),
    "trades_repair": (
        (
            "su tesisat", "sıhhi tesisat", "tesisatçı", "elektrikçi", "elektrik arıza",
            "çilingir", "anahtarcı", "kombi servis",
        ),
        (
            "tıkanıklık açma", "su kaçağı", "petek temizleme", "sigorta pano", "aydınlatma", "kilit değişimi",
        ),
    ),
    "textile_care": (
        (
            "kuru temizleme", "çamaşırhane", "terzi", "dikim evi", "giysi tadilat", "halı yıkama",
        ),
        (
            "leke çıkarma", "ütüleme", "paça kısaltma", "özel dikim", "yorgan yıkama",
        ),
    ),
    "creative_agency_it": (
        (
            "fotoğraf stüdyosu", "düğün fotoğraf", "mimarlık ofisi", "iç mimarlık",
            "mühendislik bürosu", "yazılım şirketi", "bilişim", "dijital ajans",
            "reklam ajansı", "web tasarım ajansı",
        ),
        (
            "mimari proje", "3d tasarım", "kurumsal kimlik", "sosyal medya yönetimi",
            "yazılım geliştirme", "stüdyo çekim", "dış çekim",
        ),
    ),
}


# OSM ham etiketlerinden ve Türkçe kategori adlarından 26 kategoriye doğrudan eşleme
RAW_OSM_TO_CATEGORY_KEY: dict[str, str] = {
    "restaurant": "food", "cafe": "food", "fast_food": "food", "bakery": "food",
    "pastry": "food", "bar": "food", "pub": "food", "ice_cream": "food",
    "coffee_shop": "food", "deli": "food", "confectionery": "food",
    "hairdresser": "beauty", "beauty": "beauty", "barber": "beauty",
    "spa": "beauty", "tattoo": "beauty", "cosmetics": "beauty", "perfumery": "beauty",
    "pharmacy": "pharmacy",
    "dentist": "dental",
    "veterinary": "veterinary",
    "optician": "optician",
    "doctors": "medical", "clinic": "medical", "hospital": "medical", "medical_supply": "medical",
    "car_repair": "auto", "car_wash": "auto", "car_parts": "auto", "tyres": "auto",
    "motorcycle_repair": "auto", "fuel": "auto", "car": "auto",
    "estate_agent": "real_estate",
    "lawyer": "legal", "notary": "legal",
    "accountant": "accounting_insurance", "insurance": "accounting_insurance",
    "travel_agency": "hospitality_travel", "hotel": "hospitality_travel",
    "guest_house": "hospitality_travel", "hostel": "hospitality_travel",
    "motel": "hospitality_travel", "apart_hotel": "hospitality_travel",
    "fitness_centre": "fitness_sports", "gym": "fitness_sports",
    "driving_school": "education", "language_school": "education", "prep_school": "education",
    "supermarket": "grocery_butcher", "convenience": "grocery_butcher",
    "butcher": "grocery_butcher", "greengrocer": "grocery_butcher",
    "clothes": "fashion_shoes", "shoes": "fashion_shoes",
    "jewelry": "jewelry",
    "electronics": "tech_electronics", "mobile_phone": "tech_electronics",
    "furniture": "furniture_home", "carpenter": "furniture_home",
    "hardware": "hardware",
    "florist": "florist",
    "books": "books_stationery", "stationery": "books_stationery", "copyshop": "books_stationery",
    "pet": "petshop",
    "electrician": "trades_repair", "plumber": "trades_repair", "locksmith": "trades_repair",
    "dry_cleaning": "textile_care", "laundry": "textile_care", "tailor": "textile_care",
    "photographer": "creative_agency_it", "architect": "creative_agency_it",
    "it": "creative_agency_it", "advertising_agency": "creative_agency_it",
}


SCHEMA_TYPE_TO_CATEGORY: dict[str, str] = {
    "restaurant": "food", "foodestablishment": "food", "cafeorcoffeeshop": "food",
    "bakery": "food", "fastfoodrestaurant": "food", "barorpub": "food", "icecreamshop": "food",
    "hairsalon": "beauty", "beautysalon": "beauty", "dayspa": "beauty", "tattooparlor": "beauty",
    "pharmacy": "pharmacy",
    "dentist": "dental",
    "veterinarycare": "veterinary",
    "optician": "optician",
    "medicalclinic": "medical", "hospital": "medical", "physician": "medical", "medicalbusiness": "medical",
    "autorepair": "auto", "autowash": "auto", "autodealer": "auto", "autopartsstore": "auto",
    "tireshop": "auto", "gasstation": "auto", "automotivebusiness": "auto",
    "realestateagent": "real_estate",
    "attorney": "legal", "legalservice": "legal", "notary": "legal",
    "accountingservice": "accounting_insurance", "insuranceagency": "accounting_insurance",
    "hotel": "hospitality_travel", "lodgingbusiness": "hospitality_travel", "travelagency": "hospitality_travel",
    "healthclub": "fitness_sports", "exerciseGym": "fitness_sports", "sportsactivitylocation": "fitness_sports",
    "educationalorganization": "education", "school": "education",
    "grocerystore": "grocery_butcher", "supermarket": "grocery_butcher",
    "clothingstore": "fashion_shoes", "shoestore": "fashion_shoes",
    "jewelrystore": "jewelry",
    "electronicsstore": "tech_electronics", "computerstore": "tech_electronics", "mobilephonestore": "tech_electronics",
    "furniturestore": "furniture_home", "homegoodsstore": "furniture_home",
    "hardwarestore": "hardware",
    "florist": "florist",
    "bookstore": "books_stationery", "officeequipmentstore": "books_stationery",
    "petstore": "petshop",
    "electrician": "trades_repair", "plumber": "trades_repair", "locksmith": "trades_repair",
    "drycleaningorlaundry": "textile_care",
}


def _word_boundary_hit(keyword: str, text_tr_lower: str) -> bool:
    """
    Türkçe karakter duyarlı kelime başlangıcı sınırı kontrolü.
    Kısa (<=3 harfli) kelimelerde tam kelime sınırı zorunludur; uzun kelimelerde Türkçe çekim eklerine izin verir.
    """
    if len(keyword) <= 3:
        pat = rf"(?:^|[^a-z0-9çğıöşü]){re.escape(keyword)}(?:$|[^a-z0-9çğıöşü])"
    else:
        pat = rf"(?:^|[^a-z0-9çğıöşü]){re.escape(keyword)}"
    return bool(re.search(pat, text_tr_lower))


def resolve_merchant_category_keys(category: Optional[str], name: str) -> set[str]:
    """
    İşletmenin kategori etiketi ve adından hedef sektör anahtar kümesini çıkarır.
    """
    matched: set[str] = set()
    cat_clean = _tr_lower(category or "")

    if cat_clean in RAW_OSM_TO_CATEGORY_KEY:
        matched.add(RAW_OSM_TO_CATEGORY_KEY[cat_clean])

    combined_label = f"{cat_clean} {_tr_lower(name)}"
    for cat_key, (core_words, _) in CATEGORY_KEYWORDS.items():
        for kw in core_words:
            if _word_boundary_hit(kw, combined_label):
                matched.add(cat_key)
                break

    return matched


def classify_website_categories(
    title_and_meta: str,
    headings_and_nav: str,
    body_text: str,
    schema_text: str = "",
) -> dict[str, int]:
    """
    Web sitesinin başlık, menü/alt başlık, gövde metni ve JSON-LD Schema verisini analiz ederek
    26 sektör kategorisinin her biri için ağırlıklı uyum puanı hesaplar.
    """
    scores: dict[str, int] = {k: 0 for k in CATEGORY_KEYWORDS}

    t_low = _tr_lower(title_and_meta)
    h_low = _tr_lower(headings_and_nav)
    b_low = _tr_lower(body_text[:10000])
    s_low = (schema_text or "").lower()

    for schema_key, cat_key in SCHEMA_TYPE_TO_CATEGORY.items():
        if f'"{schema_key.lower()}"' in s_low or f"/{schema_key.lower()}" in s_low:
            scores[cat_key] += 8

    for cat_key, (core_words, support_words) in CATEGORY_KEYWORDS.items():
        for kw in core_words:
            if _word_boundary_hit(kw, t_low):
                scores[cat_key] += 6
            elif _word_boundary_hit(kw, h_low):
                scores[cat_key] += 3
            elif _word_boundary_hit(kw, b_low):
                scores[cat_key] += 2

        support_hits = 0
        for kw in support_words:
            if _word_boundary_hit(kw, t_low):
                scores[cat_key] += 3
                support_hits += 1
            elif _word_boundary_hit(kw, h_low):
                scores[cat_key] += 2
                support_hits += 1
            elif support_hits < 4 and _word_boundary_hit(kw, b_low):
                scores[cat_key] += 1
                support_hits += 1

    return scores


def verify_website_matches_merchant_category(
    merchant_category: Optional[str],
    merchant_name: str,
    soup: BeautifulSoup,
    strict: bool = True,
) -> tuple[bool, Optional[str], dict[str, int]]:
    """
    İşletme kategorisi ile web sitesinin tespit edilen kategorisini karşılaştırır.
    - strict=True (arama/alan adı keşfi): Web sitesinin kategorisi işletme kategorisiyle
      açıkça örtüşmeli ve baskın kategori başka bir sektör olmamalıdır.
    - strict=False (haritada kayıtlı mevcut URL): Web sitesi açıkça bambaşka bir sektöre aitse
      (örn. düşmüş/satılmış alan adı) False döndürür.
    """
    target_cats = resolve_merchant_category_keys(merchant_category, merchant_name)

    title_txt = soup.title.string.strip() if (soup.title and soup.title.string) else ""
    h1_txt = " ".join(el.get_text(" ", strip=True) for el in soup.find_all("h1")[:3])
    og_site_el = soup.find("meta", attrs={"property": "og:site_name"})
    og_site_txt = str(og_site_el.get("content", "")).strip() if og_site_el else ""
    og_title_el = soup.find("meta", attrs={"property": "og:title"})
    og_title_txt = str(og_title_el.get("content", "")).strip() if og_title_el else ""
    meta_desc_el = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    meta_desc_txt = str(meta_desc_el.get("content", "")).strip() if meta_desc_el else ""

    title_and_meta = f"{title_txt} {h1_txt} {og_site_txt} {og_title_txt} {meta_desc_txt}"

    headings_parts = [el.get_text(" ", strip=True) for el in soup.find_all(["h2", "h3", "nav"])[:15]]
    headings_and_nav = " ".join(headings_parts)[:4000]

    schema_parts = [
        el.string or ""
        for el in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)})[:4]
    ]
    schema_text = " ".join(schema_parts)[:8000]

    body_visible = " ".join(soup.stripped_strings)[:10000]

    scores = classify_website_categories(title_and_meta, headings_and_nav, body_visible, schema_text)
    dominant_cat: Optional[str] = None
    top_score = 0
    for ck, sc in scores.items():
        if sc > top_score:
            top_score = sc
            dominant_cat = ck

    if not target_cats:
        # İşletmenin kategorisi çok genel ise ("Yerel İşletme"), keşif modunda başka bir spesifik sektör
        # aşırı baskınsa ve başlıkta işletme adı yoksa üst katmanda elenir; burada True döner.
        return True, dominant_cat, scores

    target_score = max((scores.get(c, 0) for c in target_cats), default=0)

    if strict:
        # Web sitesinde işletme kategorisine ait anlamlı sinyal bulunmalı (en az 4 puan)
        # ve sitenin baskın kategorisi bambaşka bir sektör olmamalıdır.
        if target_score < 4:
            return False, dominant_cat, scores
        if top_score > 0 and target_score < (top_score * 0.65):
            return False, dominant_cat, scores
        return True, dominant_cat, scores

    # strict=False (OSM üzerinde kayıtlı URL kontrolü):
    # Sitede işletmenin kendi kategorisine dair SIFIR sinyal varken bambaşka bir sektör çok baskınsa (>=8 puan)
    # bu alan adı el değiştirmiş / yanlış girilmiş demektir.
    if target_score == 0 and top_score >= 8:
        return False, dominant_cat, scores

    return True, dominant_cat, scores
