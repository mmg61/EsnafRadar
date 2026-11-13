import asyncio
import httpx
import logging
import math
import time
from fastapi import HTTPException
from typing import List, Dict, Any, Tuple
from services.brands import resolve_known_brand_website
from services.auditor import _normalize_tr_phone

# Yedek Overpass API Sunucuları (Paralel yarış için)
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Kısa süreli bellek içi (in-memory) tarama önbelleği: {(lat_r, lon_r, radius): (timestamp, elements)}
_RAW_BBOX_CACHE: Dict[Tuple[float, float, int], Tuple[float, List[Dict[str, Any]]]] = {}
_CACHE_TTL_SECONDS = 600  # 10 dakika

# Kapsamlı Türkçe Kategori Sözlüğü & Grupları
CATEGORY_MAP: Dict[str, tuple[str, str, str]] = {
    # Yeme & İçme (food)
    "restaurant": ("Restoran & Lokanta", "food", "YMK"),
    "cafe": ("Kafe & Kahve", "food", "KFE"),
    "fast_food": ("Fast Food / Dürüm & Burger", "food", "FFD"),
    "bakery": ("Fırın & Unlu Mamuller", "food", "FRN"),
    "pastry": ("Pastane & Tatlı", "food", "PST"),
    "bar": ("Bar & Pub", "food", "BAR"),
    "pub": ("Pub / Gece Kulübü", "food", "PUB"),
    "ice_cream": ("Dondurmacı", "food", "DND"),
    "coffee_shop": ("Kahve Dükkanı", "food", "KFE"),
    "deli": ("Şarküteri & Meze", "food", "SRK"),
    "confectionery": ("Şekerleme & Tatlıcı", "food", "TTL"),

    # Güzellik & Bakım (beauty)
    "hairdresser": ("Kuaför & Berber", "beauty", "KFR"),
    "beauty": ("Güzellik & Cilt Bakım Merkezi", "beauty", "GZL"),
    "barber": ("Erkek Berberi", "beauty", "BRB"),
    "spa": ("Spa & Masaj Salonu", "beauty", "SPA"),
    "tattoo": ("Dövme & Piercing Stüdyosu", "beauty", "DVM"),
    "cosmetics": ("Kozmetik & Bakım Mağazası", "beauty", "KZM"),
    "perfumery": ("Parfümeri", "beauty", "PRF"),

    # Oto & Sanayi (auto)
    "car_repair": ("Oto Tamir & Servis", "auto", "OTO"),
    "car_wash": ("Oto Yıkama & Detailing", "auto", "YKM"),
    "car_parts": ("Oto Yedek Parça", "auto", "PRC"),
    "tyres": ("Oto Lastik & Jant Servisi", "auto", "LST"),
    "motorcycle_repair": ("Motosiklet Tamir & Bakım", "auto", "MTR"),
    "fuel": ("Akaryakıt İstasyonu", "auto", "YKT"),
    "car": ("Oto Galeri & Bayi", "auto", "GLR"),

    # Perakende & Alışveriş (retail)
    "supermarket": ("Süpermarket", "retail", "MKT"),
    "convenience": ("Market & Bakkal", "retail", "BKL"),
    "clothes": ("Giyim & Butik Mağaza", "retail", "GYM"),
    "shoes": ("Ayakkabı Mağazası", "retail", "AYK"),
    "jewelry": ("Kuyumcu & Mücevher", "retail", "KYM"),
    "electronics": ("Elektronik & Telefon", "retail", "ELK"),
    "mobile_phone": ("Telefon & Teknoloji Mağazası", "retail", "TEL"),
    "optician": ("Optik & Gözlükçü", "retail", "OPT"),
    "florist": ("Çiçekçi", "retail", "CCK"),
    "books": ("Kitabevi & Sahaf", "retail", "KTP"),
    "stationery": ("Kırtasiye & Ofis Malzemeleri", "retail", "KRT"),
    "butcher": ("Kasap & Şarküteri", "retail", "KSP"),
    "greengrocer": ("Manav & Organik Pazar", "retail", "MNV"),
    "pet": ("Petshop & Akvaryum", "retail", "PET"),
    "hardware": ("Hırdavat & Nalburiye", "retail", "HRD"),
    "furniture": ("Mobilya & Dekorasyon", "retail", "MBL"),

    # Sağlık & Medikal (health)
    "pharmacy": ("Eczane", "health", "ECZ"),
    "dentist": ("Diş Kliniği / Diş Hekimi", "health", "DIS"),
    "doctors": ("Doktor Muayenehanesi / Klinik", "health", "DR"),
    "clinic": ("Poliklinik & Tıp Merkezi", "health", "KLN"),
    "veterinary": ("Veteriner Kliniği", "health", "VET"),
    "hospital": ("Tıp Merkezi & Hastane", "health", "HST"),
    "medical_supply": ("Medikal & Ortopedi", "health", "MED"),

    # Hizmet & Ofis (services)
    "estate_agent": ("Emlak Danışmanlığı / Gayrimenkul", "services", "EML"),
    "lawyer": ("Hukuk & Avukatlık Bürosu", "services", "HUK"),
    "accountant": ("Mali Müşavir & Muhasebe", "services", "MHS"),
    "insurance": ("Sigorta Acentesi", "services", "SGR"),
    "travel_agency": ("Turizm & Seyahat Acentesi", "services", "TRZ"),
    "dry_cleaning": ("Kuru Temizleme & Terzi", "services", "TMZ"),
    "laundry": ("Çamaşırhane & Kuru Temizleme", "services", "CMS"),
    "tailor": ("Terzi & Dikim Evi", "services", "TRZ"),
    "copyshop": ("Baskı & Kırtasiye Merkezi", "services", "BSK"),
    "photographer": ("Fotoğraf Stüdyosu", "services", "FTO"),
    "architect": ("Mimarlık & Mühendislik Ofisi", "services", "MMR"),
    "company": ("Kurumsal Şirket Ofisi", "services", "OFS"),
    "it": ("Bilişim & Yazılım Ofisi", "services", "BT"),
    "advertising_agency": ("Reklam & Dijital Ajans", "services", "AJN"),
    "notary": ("Noterlik", "services", "NTR"),
    "electrician": ("Elektrik & Teknik Servis", "services", "ELK"),
    "plumber": ("Tesisat & Sıhhi Tesisat", "services", "TSS"),
    "locksmith": ("Çilingir & Anahtarcı", "services", "CLG"),
    "carpenter": ("Marangoz & Mobilya Atölyesi", "services", "MRG"),
    "driving_school": ("Sürücü Kursu", "services", "SRC"),
    "language_school": ("Dil Kursu & Eğitim Merkezi", "services", "DIL"),
    "prep_school": ("Özel Eğitim & Etüt Merkezi", "services", "EGT"),
    "fitness_centre": ("Fitness & Spor Salonu", "sports", "SPR"),
    "gym": ("Spor Salonu / Gym", "sports", "SPR"),
    "hotel": ("Otel & Butik Konaklama", "services", "OTL"),
    "guest_house": ("Butik Otel & Pansiyon", "services", "PNS"),
    "hostel": ("Hostel & Konaklama", "services", "HST"),
    "motel": ("Motel & Konaklama", "services", "MTL"),
    "apart_hotel": ("Apart Otel", "services", "APT"),
}

EXCLUDED_AMENITIES = {
    "bench", "waste_basket", "recycling", "fountain", "toilets", "drinking_water",
    "post_box", "telephone", "bicycle_parking", "parking_space", "parking", "parking_entrance",
    "shelter", "clock", "vending_machine", "atm", "place_of_worship", "grave_yard",
    "police", "fire_station", "townhall", "courthouse", "prison", "public_building",
    "ferry_terminal", "bus_station", "taxi"
}


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _compute_bbox(lat: float, lon: float, radius_m: int) -> Tuple[float, float, float, float]:
    lat_delta = radius_m / 111320.0
    lon_delta = radius_m / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    return (lon - lon_delta, lat - lat_delta, lon + lon_delta, lat + lat_delta)


def format_address(tags: Dict[str, Any]) -> str:
    parts = []
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    if street:
        parts.append(f"{street} No:{housenumber}" if housenumber else street)
    district = tags.get("addr:suburb") or tags.get("addr:district") or tags.get("addr:neighbourhood")
    if district:
        parts.append(district)
    city = tags.get("addr:city") or tags.get("addr:province")
    if city:
        parts.append(city)
    if not parts and tags.get("addr:full"):
        return str(tags.get("addr:full")).strip()
    return ", ".join(parts).strip(" ,") if parts else "Adres detayı belirtilmemiş"


def get_category_info(tags: Dict[str, Any]) -> tuple[str, str, str, str]:
    raw_cat = (
        tags.get("shop")
        or tags.get("amenity")
        or tags.get("craft")
        or tags.get("office")
        or tags.get("healthcare")
        or tags.get("tourism")
        or tags.get("leisure")
        or "general"
    )

    if raw_cat in CATEGORY_MAP:
        label, group, icon = CATEGORY_MAP[raw_cat]
        return raw_cat, label, group, icon

    clean_label = raw_cat.replace("_", " ").title()
    return raw_cat, f"Yerel İşletme ({clean_label})", "other", "ISL"


def calculate_opportunity(
    phone: str | None,
    website: str | None,
    instagram: str | None,
    email: str | None = None,
    is_corporate_chain: bool = False
) -> tuple[int, str]:
    has_web = bool(website and len(website.strip()) > 3)
    has_tel = bool(phone and len(phone.strip()) > 3)
    has_insta = bool(instagram and len(instagram.strip()) > 2)
    has_mail = bool(email and len(email.strip()) > 3)

    if is_corporate_chain:
        return 20, "Kurumsal Zincir (Web Mevcut)"

    if not has_web and has_tel:
        return 95, "Acil Web Sitesi (Telefonu Var)"
    elif not has_web and (has_insta or has_mail):
        return 90, "Sadece Sosyal Medya (Web Yok)"
    elif not has_web:
        return 80, "Yüksek Potansiyel (Web Yok)"
    else:
        if has_tel:
            return 50, "Web Sitesi Mevcut (İyileştirme Fırsatı)"
        return 40, "Web Sitesi Mevcut"


def _matches_category(tags: Dict[str, Any], category: str) -> bool:
    shop = tags.get("shop")
    amenity = tags.get("amenity")
    craft = tags.get("craft")
    office = tags.get("office")
    healthcare = tags.get("healthcare")
    tourism = tags.get("tourism")
    leisure = tags.get("leisure")

    if amenity in EXCLUDED_AMENITIES:
        return False

    if category == "food":
        return (
            amenity in {"restaurant", "cafe", "fast_food", "bakery", "bar", "pub", "ice_cream", "food_court", "biergarten"}
            or shop in {"bakery", "pastry", "deli", "confectionery", "coffee", "tea", "coffee_shop", "ice_cream"}
        )
    if category == "beauty":
        return (
            shop in {"hairdresser", "beauty", "barber", "tattoo", "cosmetics", "perfumery"}
            or amenity in {"spa"}
        )
    if category == "auto":
        return (
            shop in {"car_repair", "car_parts", "tyres", "motorcycle_repair", "car", "motorcycle"}
            or amenity in {"car_wash", "fuel"}
            or craft in {"car_repair"}
        )
    if category == "retail":
        return bool(shop)
    if category == "health":
        return (
            amenity in {"pharmacy", "dentist", "doctors", "hospital", "veterinary", "clinic"}
            or bool(healthcare)
            or shop in {"medical_supply", "optician", "hearing_aids", "herbalist"}
        )
    if category == "services":
        return (
            bool(office)
            or bool(craft)
            or tourism in {"hotel", "guest_house", "hostel", "motel", "apart_hotel", "chalet"}
            or leisure in {"fitness_centre", "sports_centre"}
        )

    # category == "all"
    return (
        bool(shop)
        or bool(amenity)
        or bool(craft)
        or bool(office)
        or bool(healthcare)
        or tourism in {"hotel", "guest_house", "hostel", "motel", "apart_hotel", "chalet"}
        or leisure in {"fitness_centre", "sports_centre"}
    )


async def _fetch_osm_map_bbox(lat: float, lon: float, safe_radius: int) -> List[Dict[str, Any]] | None:
    """
    OpenStreetMap resmi v0.6 map.json uç noktasından ~0.8 - 2.5 saniyede bölgedeki tüm
    düğüm ve bina poligonlarını (node + way) çeker. Yoğun bölgelerde 50.000 düğüm sınırına
    takılırsa yarıçapı kademeli daraltarak tekrar dener.
    """
    cache_key = (round(lat, 4), round(lon, 4), safe_radius)
    now = time.time()
    cached = _RAW_BBOX_CACHE.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    headers = {
        "Accept": "application/json",
        "User-Agent": "EsnafRadarApp/2.5 (destek@esnafradar.com)"
    }

    candidate_radii = [safe_radius]
    if safe_radius > 1200:
        candidate_radii.append(1200)
    if safe_radius > 800:
        candidate_radii.append(800)

    async with httpx.AsyncClient(timeout=10.0) as client:
        for r_try in candidate_radii:
            min_lon, min_lat, max_lon, max_lat = _compute_bbox(lat, lon, r_try)
            url = f"https://api.openstreetmap.org/api/0.6/map.json?bbox={min_lon:.6f},{min_lat:.6f},{max_lon:.6f},{max_lat:.6f}"
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    _RAW_BBOX_CACHE[cache_key] = (now, elements)
                    return elements
                elif resp.status_code == 400:
                    # Çok yoğun bölge (50.000 node sınırı), bir alt yarıçapı dene
                    continue
            except Exception as e:
                logging.warning(f"OSM map.json bağlantı uyarısı (r={r_try}m): {type(e).__name__}: {e}")
                break

    return None


async def _fetch_overpass_parallel(lat: float, lon: float, safe_radius: int) -> List[Dict[str, Any]] | None:
    """
    Yedek olarak tüm Overpass sunucularına sırayla beklemek yerine eşzamanlı (paralel) istek atar,
    ilk yanıt veren sunucunun sonucunu alır.
    """
    min_lon, min_lat, max_lon, max_lat = _compute_bbox(lat, lon, safe_radius)
    bbox_str = f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}"
    query = f"""[out:json][timeout:8][bbox:{bbox_str}];
(
  nw["name"]["shop"];
  nw["name"]["amenity"];
  nw["name"]["craft"];
  nw["name"]["office"];
  nw["name"]["healthcare"];
  nw["name"]["tourism"~"hotel|guest_house|hostel|motel|apart_hotel"];
  nw["name"]["leisure"~"fitness_centre|sports_centre"];
);
out center 350;"""

    headers = {"User-Agent": "EsnafRadarApp/2.5 (destek@esnafradar.com)"}

    async def _call_single(url: str) -> List[Dict[str, Any]] | None:
        try:
            async with httpx.AsyncClient(timeout=8.5) as client:
                r = await client.post(url, data={"data": query}, headers=headers)
                if r.status_code == 200:
                    return r.json().get("elements", [])
        except Exception:
            pass
        return None

    tasks = [asyncio.create_task(_call_single(u)) for u in OVERPASS_URLS]
    try:
        for coro in asyncio.as_completed(tasks):
            res = await coro
            if res is not None:
                for t in tasks:
                    if not t.done():
                        t.cancel()
                return res
    finally:
        for t in tasks:
            if not t.done():
                t.cancel()
    return None


async def search_merchants(lat: float, lon: float, radius: int, category: str = "all") -> List[Dict[str, Any]]:
    safe_radius = max(100, min(radius, 2500))

    # 1. Birincil Hızlı Motor: OpenStreetMap v0.6 map.json (~0.7s - 2.5s)
    elements = await _fetch_osm_map_bbox(lat, lon, safe_radius)

    # 2. Yedek Motor: Paralel Overpass yarışması
    if elements is None:
        elements = await _fetch_overpass_parallel(lat, lon, safe_radius)

    if elements is None:
        raise HTTPException(
            status_code=503,
            detail="Harita tarama sunucuları şu an yoğun. Lütfen birkaç saniye sonra tekrar deneyin."
        )

    # Bina poligonlarının (way) merkez koordinatını hesaplamak için düğüm (node) tablosu
    node_coords: Dict[int, Tuple[float, float]] = {}
    for el in elements:
        if el.get("type") == "node" and "lat" in el and "lon" in el:
            node_coords[el["id"]] = (float(el["lat"]), float(el["lon"]))

    dedup_map: Dict[str, Dict[str, Any]] = {}

    for element in elements:
        tags = element.get("tags")
        if not tags:
            continue

        name = tags.get("name")
        if not name or len(name.strip()) < 2:
            continue

        if not _matches_category(tags, category):
            continue

        el_lat = element.get("lat") or (element.get("center") or {}).get("lat")
        el_lon = element.get("lon") or (element.get("center") or {}).get("lon")

        # Eğer bina poligonu (way) ise ve 'center' alanı yoksa düğümlerin ortalamasını al
        if (el_lat is None or el_lon is None) and element.get("type") == "way":
            pts = [node_coords[nid] for nid in element.get("nodes", []) if nid in node_coords]
            if pts:
                el_lat = sum(p[0] for p in pts) / len(pts)
                el_lon = sum(p[1] for p in pts) / len(pts)

        if el_lat is None or el_lon is None:
            continue

        el_lat_f = float(el_lat)
        el_lon_f = float(el_lon)

        # Dairesel yarıçap kontrolü (tam yarıçap içinde kalanları filtrele)
        if _haversine_meters(lat, lon, el_lat_f, el_lon_f) > safe_radius * 1.15:
            continue

        raw_cat, label, group, icon = get_category_info(tags)

        raw_phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("mobile")
            or tags.get("contact:mobile")
            or tags.get("whatsapp")
            or tags.get("contact:whatsapp")
        )
        phone = (
            _normalize_tr_phone(raw_phone.split(";")[0].split(",")[0])
            or raw_phone.split(";")[0].strip()
        ) if raw_phone else None

        email = tags.get("email") or tags.get("contact:email")
        osm_website = (
            tags.get("website")
            or tags.get("contact:website")
            or tags.get("url")
            or tags.get("brand:website")
            or tags.get("operator:website")
            or tags.get("facebook")
            or tags.get("contact:facebook")
        )
        brand_url = resolve_known_brand_website(name, tags.get("brand"), tags.get("operator"))
        is_corporate_chain = bool(brand_url)

        if osm_website:
            website = osm_website
            website_source = "osm"
        elif brand_url:
            website = brand_url
            website_source = "brand_chain"
        else:
            website = None
            website_source = None

        instagram = tags.get("contact:instagram") or tags.get("instagram")
        opening_hours = tags.get("opening_hours")
        address = format_address(tags)

        score, badge = calculate_opportunity(phone, website, instagram, email, is_corporate_chain)

        item = {
            "osm_id": str(element.get("id")),
            "name": name.strip(),
            "latitude": el_lat_f,
            "longitude": el_lon_f,
            "category": raw_cat,
            "category_group": group,
            "category_label": label,
            "category_icon": icon,
            "phone": phone,
            "email": email,
            "website": website,
            "website_source": website_source,
            "is_corporate_chain": is_corporate_chain,
            "instagram": instagram,
            "opening_hours": opening_hours,
            "address": address,
            "opportunity_badge": badge,
            "lead_potential_score": score,
        }

        dedup_key = f"{name.strip().lower()}_{round(el_lat_f, 3)}_{round(el_lon_f, 3)}"
        if dedup_key in dedup_map:
            existing = dedup_map[dedup_key]
            for field in ["phone", "email", "website", "website_source", "instagram", "opening_hours"]:
                if not existing.get(field) and item.get(field):
                    existing[field] = item[field]
            if item.get("is_corporate_chain"):
                existing["is_corporate_chain"] = True
            if existing.get("address") == "Adres detayı belirtilmemiş" and item.get("address") != "Adres detayı belirtilmemiş":
                existing["address"] = item["address"]
            new_score, new_badge = calculate_opportunity(
                existing.get("phone"),
                existing.get("website"),
                existing.get("instagram"),
                existing.get("email"),
                bool(existing.get("is_corporate_chain"))
            )
            existing["lead_potential_score"] = new_score
            existing["opportunity_badge"] = new_badge
        else:
            dedup_map[dedup_key] = item

    results = list(dedup_map.values())
    results.sort(
        key=lambda x: (
            0 if x.get("is_corporate_chain") else 1,
            x["lead_potential_score"],
            1 if x.get("phone") else 0,
            1 if x.get("instagram") or x.get("email") else 0
        ),
        reverse=True
    )
    return results[:350]
