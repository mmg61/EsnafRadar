import httpx
import logging
from fastapi import HTTPException
from typing import List, Dict, Any

# Overpass API Sunucuları (Hızlı ve stabil olanlar en başta)
OVERPASS_URLS = [
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

# Kapsamlı Türkçe Kategori Sözlüğü & Grupları
CATEGORY_MAP: Dict[str, tuple[str, str, str]] = {
    # tag_value: (Türkçe Etiket, Grup Kodu, Emoji İkon)
    # Yeme & İçme (food)
    "restaurant": ("Restoran & Lokanta", "food", "🍽️"),
    "cafe": ("Kafe & Kahve", "food", "☕"),
    "fast_food": ("Fast Food / Dürüm & Burger", "food", "🍔"),
    "bakery": ("Fırın & Unlu Mamuller", "food", "🥖"),
    "pastry": ("Pastane & Tatlı", "food", "🍰"),
    "bar": ("Bar & Pub", "food", "🍸"),
    "pub": ("Pub / Gece Kulübü", "food", "🍺"),
    "ice_cream": ("Dondurmacı", "food", "🍦"),
    "coffee_shop": ("Kahve Dükkanı", "food", "☕"),
    "deli": ("Şarküteri & Meze", "food", "🧀"),

    # Güzellik & Bakım (beauty)
    "hairdresser": ("Kuaför & Berber", "beauty", "💇"),
    "beauty": ("Güzellik & Cilt Bakım Merkezi", "beauty", "💅"),
    "barber": ("Erkek Berberi", "beauty", "💈"),
    "spa": ("Spa & Masaj Salonu", "beauty", "🧖"),
    "tattoo": ("Dövme & Piercing Stüdyosu", "beauty", "🎨"),

    # Oto & Sanayi (auto)
    "car_repair": ("Oto Tamir & Servis", "auto", "🔧"),
    "car_wash": ("Oto Yıkama & Detailing", "auto", "🚗"),
    "car_parts": ("Oto Yedek Parça", "auto", "⚙️"),
    "tyres": ("Oto Lastik & Jant Servisi", "auto", "🛞"),
    "motorcycle_repair": ("Motosiklet Tamir & Bakım", "auto", "🏍️"),

    # Perakende & Alışveriş (retail)
    "supermarket": ("Süpermarket", "retail", "🛒"),
    "convenience": ("Market & Bakkal", "retail", "🏪"),
    "clothes": ("Giyim & Butik Mağaza", "retail", "👗"),
    "shoes": ("Ayakkabı Mağazası", "retail", "👠"),
    "jewelry": ("Kuyumcu & Mücevher", "retail", "💎"),
    "electronics": ("Elektronik & Telefon", "retail", "📱"),
    "optician": ("Optik & Gözlükçü", "retail", "👓"),
    "florist": ("Çiçekçi", "retail", "💐"),
    "books": ("Kitabevi & Sahaf", "retail", "📚"),
    "stationery": ("Kırtasiye & Ofis Malzemeleri", "retail", "✏️"),
    "butcher": ("Kasap & Şarküteri", "retail", "🥩"),
    "greengrocer": ("Manav & Organik Pazar", "retail", "🍎"),
    "pet": ("Petshop & Akvaryum", "retail", "🐾"),
    "hardware": ("Hırdavat & Nalburiye", "retail", "🔨"),
    "furniture": ("Mobilya & Dekorasyon", "retail", "🛋️"),

    # Sağlık & Medikal (health)
    "pharmacy": ("Eczane", "health", "💊"),
    "dentist": ("Diş Kliniği / Diş Hekimi", "health", "🦷"),
    "doctors": ("Doktor Muayenehanesi / Klinik", "health", "🩺"),
    "clinic": ("Poliklinik & Tıp Merkezi", "health", "🏥"),
    "veterinary": ("Veteriner Kliniği", "health", "🐕"),
    "hospital": ("Tıp Merkezi & Hastane", "health", "🏥"),
    "medical_supply": ("Medikal & Ortopedi", "health", "🩺"),

    # Hizmet & Ofis (services)
    "estate_agent": ("Emlak Danışmanlığı / Gayrimenkul", "services", "🏠"),
    "lawyer": ("Hukuk & Avukatlık Bürosu", "services", "⚖️"),
    "accountant": ("Mali Müşavir & Muhasebe", "services", "📊"),
    "insurance": ("Sigorta Acentesi", "services", "🛡️"),
    "travel_agency": ("Turizm & Seyahat Acentesi", "services", "✈️"),
    "dry_cleaning": ("Kuru Temizleme & Terzi", "services", "👔"),
    "laundry": ("Çamaşırhane & Kuru Temizleme", "services", "👔"),
    "tailor": ("Terzi & Dikim Evi", "services", "🪡"),
    "copyshop": ("Baskı & Kırtasiye Merkezi", "services", "🖨️"),
    "photographer": ("Fotoğraf Stüdyosu", "services", "📷"),
    "architect": ("Mimarlık & Mühendislik Ofisi", "services", "📐"),
    "company": ("Kurumsal Şirket Ofisi", "services", "🏢"),
    "it": ("Bilişim & Yazılım Ofisi", "services", "💻"),
    "advertising_agency": ("Reklam & Dijital Ajans", "services", "📢"),
    "notary": ("Noterlik", "services", "✒️"),
    "electrician": ("Elektrik & Teknik Servis", "services", "⚡"),
    "plumber": ("Tesisat & Sıhhi Tesisat", "services", "🔧"),
    "locksmith": ("Çilingir & Anahtarcı", "services", "🔑"),
    "carpenter": ("Marangoz & Mobilya Atölyesi", "services", "🪚"),
    "driving_school": ("Sürücü Kursu", "services", "🚗"),
    "language_school": ("Dil Kursu & Eğitim Merkezi", "services", "🎓"),
    "prep_school": ("Özel Eğitim & Etüt Merkezi", "services", "🎓"),
    "fitness_centre": ("Fitness & Spor Salonu", "sports", "🏋️"),
    "gym": ("Spor Salonu / Gym", "sports", "💪"),
    "hotel": ("Otel & Butik Konaklama", "services", "🏨"),
    "guest_house": ("Butik Otel & Pansiyon", "services", "🏨"),
    "hostel": ("Hostel & Konaklama", "services", "🏨"),
}

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
    return raw_cat, f"Yerel İşletme ({clean_label})", "other", "🏢"

def calculate_opportunity(phone: str | None, website: str | None, instagram: str | None, email: str | None = None) -> tuple[int, str]:
    has_web = bool(website and len(website.strip()) > 3)
    has_tel = bool(phone and len(phone.strip()) > 3)
    has_insta = bool(instagram and len(instagram.strip()) > 2)
    has_mail = bool(email and len(email.strip()) > 3)

    if not has_web and has_tel:
        return 95, "🚨 Acil Web Sitesi (Telefonu Var)"
    elif not has_web and (has_insta or has_mail):
        return 90, "📸 Sadece Sosyal Medya (Web Yok)"
    elif not has_web:
        return 80, "⭐ Yüksek Potansiyel (Web Yok)"
    else:
        if has_tel:
            return 50, "🌐 Web Sitesi Mevcut (SEO & Denetim)"
        return 40, "🌐 Web Sitesi Mevcut"

async def search_merchants(lat: float, lon: float, radius: int, category: str = "all") -> List[Dict[str, Any]]:
    # Yarıçap sınırlandırması (performans ve hız için 100m - 2500m)
    safe_radius = max(100, min(radius, 2500))

    # Kategori Filtreleme Sorgusu (nwr = node + way + relation; bina poligonlarını da kapsar)
    if category == "food":
        cat_filter = """
          nwr["name"]["amenity"~"restaurant|cafe|fast_food|bakery|bar|pub|ice_cream"](around:{radius},{lat},{lon});
          nwr["name"]["shop"~"bakery|pastry|deli|confectionery|coffee|tea"](around:{radius},{lat},{lon});
        """
    elif category == "beauty":
        cat_filter = """
          nwr["name"]["shop"~"hairdresser|beauty|barber|tattoo|cosmetics|perfumery"](around:{radius},{lat},{lon});
          nwr["name"]["amenity"~"spa"](around:{radius},{lat},{lon});
        """
    elif category == "auto":
        cat_filter = """
          nwr["name"]["shop"~"car_repair|car_parts|tyres|motorcycle_repair|car"](around:{radius},{lat},{lon});
          nwr["name"]["amenity"~"car_wash|fuel"](around:{radius},{lat},{lon});
          nwr["name"]["craft"~"car_repair"](around:{radius},{lat},{lon});
        """
    elif category == "retail":
        cat_filter = """
          nwr["name"]["shop"](around:{radius},{lat},{lon});
        """
    elif category == "health":
        cat_filter = """
          nwr["name"]["amenity"~"pharmacy|dentist|doctors|hospital|veterinary|clinic"](around:{radius},{lat},{lon});
          nwr["name"]["healthcare"](around:{radius},{lat},{lon});
          nwr["name"]["shop"~"medical_supply|optician"](around:{radius},{lat},{lon});
        """
    elif category == "services":
        cat_filter = """
          nwr["name"]["office"](around:{radius},{lat},{lon});
          nwr["name"]["craft"](around:{radius},{lat},{lon});
          nwr["name"]["tourism"~"hotel|guest_house|hostel"](around:{radius},{lat},{lon});
          nwr["name"]["leisure"~"fitness_centre|sports_centre"](around:{radius},{lat},{lon});
        """
    else: # all (tam tarama)
        cat_filter = """
          nwr["name"]["shop"](around:{radius},{lat},{lon});
          nwr["name"]["amenity"](around:{radius},{lat},{lon});
          nwr["name"]["craft"](around:{radius},{lat},{lon});
          nwr["name"]["office"](around:{radius},{lat},{lon});
          nwr["name"]["healthcare"](around:{radius},{lat},{lon});
          nwr["name"]["tourism"~"hotel|guest_house|hostel|motel"](around:{radius},{lat},{lon});
          nwr["name"]["leisure"~"fitness_centre|sports_centre"](around:{radius},{lat},{lon});
        """

    query = f"""[out:json][timeout:25];
    (
      {cat_filter.format(radius=safe_radius, lat=lat, lon=lon)}
    );
    out center 350;"""

    headers = {
        "User-Agent": "EsnafRadarApp/2.5 (destek@esnafradar.com)"
    }

    # Ticari olmayan kamu/altyapı amenity türlerini filtrele
    excluded_amenities = {
        "bench", "waste_basket", "recycling", "fountain", "toilets", "drinking_water",
        "post_box", "telephone", "bicycle_parking", "parking_space", "shelter", "clock",
        "vending_machine", "atm", "place_of_worship", "grave_yard", "police", "fire_station",
        "townhall", "courthouse", "prison", "public_building"
    }

    async with httpx.AsyncClient(timeout=22.0) as client:
        for url in OVERPASS_URLS:
            try:
                response = await client.get(url, params={"data": query}, headers=headers)
                if response.status_code != 200:
                    response = await client.post(url, data=query, headers=headers)
                
                response.raise_for_status()
                data = response.json()
                
                dedup_map: Dict[str, Dict[str, Any]] = {}
                for element in data.get("elements", []):
                    tags = element.get("tags", {})
                    name = tags.get("name")
                    if not name or len(name.strip()) < 2:
                        continue

                    amenity_type = tags.get("amenity")
                    if amenity_type in excluded_amenities:
                        continue
                    
                    el_lat = element.get("lat") or (element.get("center") or {}).get("lat")
                    el_lon = element.get("lon") or (element.get("center") or {}).get("lon")
                    if el_lat is None or el_lon is None:
                        continue

                    raw_cat, label, group, icon = get_category_info(tags)
                    
                    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("mobile") or tags.get("contact:mobile") or tags.get("whatsapp") or tags.get("contact:whatsapp")
                    email = tags.get("email") or tags.get("contact:email")
                    website = tags.get("website") or tags.get("contact:website") or tags.get("url") or tags.get("facebook") or tags.get("contact:facebook")
                    instagram = tags.get("contact:instagram") or tags.get("instagram")
                    opening_hours = tags.get("opening_hours")
                    address = format_address(tags)

                    score, badge = calculate_opportunity(phone, website, instagram, email)

                    item = {
                        "osm_id": str(element.get("id")),
                        "name": name.strip(),
                        "latitude": float(el_lat),
                        "longitude": float(el_lon),
                        "category": raw_cat,
                        "category_group": group,
                        "category_label": label,
                        "category_icon": icon,
                        "phone": phone,
                        "email": email,
                        "website": website,
                        "instagram": instagram,
                        "opening_hours": opening_hours,
                        "address": address,
                        "opportunity_badge": badge,
                        "lead_potential_score": score,
                    }

                    # Aynı isim ve yakın koordinattaki mükerrer bina/nokta kayıtlarını birleştir
                    dedup_key = f"{name.strip().lower()}_{round(float(el_lat), 3)}_{round(float(el_lon), 3)}"
                    if dedup_key in dedup_map:
                        existing = dedup_map[dedup_key]
                        for field in ["phone", "email", "website", "instagram", "opening_hours"]:
                            if not existing.get(field) and item.get(field):
                                existing[field] = item[field]
                        if existing.get("address") == "Adres detayı belirtilmemiş" and item.get("address") != "Adres detayı belirtilmemiş":
                            existing["address"] = item["address"]
                        new_score, new_badge = calculate_opportunity(
                            existing.get("phone"), existing.get("website"), existing.get("instagram"), existing.get("email")
                        )
                        existing["lead_potential_score"] = new_score
                        existing["opportunity_badge"] = new_badge
                    else:
                        dedup_map[dedup_key] = item

                results = list(dedup_map.values())
                # Sonuçları fırsat puanına (ve ardından iletişim verisi zenginliğine) göre yüksekten düşüğe sırala
                results.sort(
                    key=lambda x: (
                        x["lead_potential_score"],
                        1 if x.get("phone") else 0,
                        1 if x.get("instagram") or x.get("email") else 0
                    ),
                    reverse=True
                )
                return results

            except Exception as e:
                logging.warning(f"Overpass sunucusu yanıt vermedi ({url}): {e}")
                continue

        raise HTTPException(
            status_code=503,
            detail="Harita tarama sunucuları şu an yoğun. Lütfen birkaç saniye sonra tekrar deneyin."
        )
