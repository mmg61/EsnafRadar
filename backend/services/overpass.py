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
    "veterinary": ("Veteriner Kliniği", "health", "🐕"),
    "hospital": ("Tıp Merkezi & Hastane", "health", "🏥"),

    # Hizmet & Ofis (services)
    "estate_agent": ("Emlak Danışmanlığı / Gayrimenkul", "services", "🏠"),
    "lawyer": ("Hukuk & Avukatlık Bürosu", "services", "⚖️"),
    "accountant": ("Mali Müşavir & Muhasebe", "services", "📊"),
    "travel_agency": ("Turizm & Seyahat Acentesi", "services", "✈️"),
    "dry_cleaning": ("Kuru Temizleme & Terzi", "services", "👔"),
    "tailor": ("Terzi & Dikim Evi", "services", "🪡"),
    "fitness_centre": ("Fitness & Spor Salonu", "sports", "🏋️"),
    "gym": ("Spor Salonu / Gym", "sports", "💪"),
    "hotel": ("Otel & Butik Konaklama", "services", "🏨"),
}

def format_address(tags: Dict[str, Any]) -> str:
    parts = []
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    if street:
        parts.append(f"{street} No:{housenumber}" if housenumber else street)
    district = tags.get("addr:suburb") or tags.get("addr:district")
    if district:
        parts.append(district)
    city = tags.get("addr:city") or tags.get("addr:province")
    if city:
        parts.append(city)
    return ", ".join(parts).strip(" ,") if parts else "Adres detayı belirtilmemiş"

def get_category_info(tags: Dict[str, Any]) -> tuple[str, str, str, str]:
    raw_cat = tags.get("shop") or tags.get("amenity") or tags.get("craft") or tags.get("office") or tags.get("healthcare") or tags.get("tourism") or "general"
    
    if raw_cat in CATEGORY_MAP:
        label, group, icon = CATEGORY_MAP[raw_cat]
        return raw_cat, label, group, icon
    
    # Bilinmeyen / genel kategoriler için temizleme
    clean_label = raw_cat.replace("_", " ").title()
    return raw_cat, f"Yerel İşletme ({clean_label})", "other", "🏢"

def calculate_opportunity(phone: str | None, website: str | None, instagram: str | None) -> tuple[int, str]:
    has_web = bool(website and len(website.strip()) > 3)
    has_tel = bool(phone and len(phone.strip()) > 3)
    has_insta = bool(instagram and len(instagram.strip()) > 2)

    if not has_web and has_tel:
        return 95, "🚨 Acil Web Sitesi (Telefonu Var)"
    elif not has_web and has_insta:
        return 90, "📸 Sadece Instagram'da (Web Yok)"
    elif not has_web:
        return 80, "⭐ Yüksek Potansiyel (Web Yok)"
    else:
        if has_tel:
            return 45, "🌐 Web Sitesi Mevcut (SEO & Yenileme)"
        return 35, "🌐 Web Sitesi Mevcut"

async def search_merchants(lat: float, lon: float, radius: int, category: str = "all") -> List[Dict[str, Any]]:
    # Yarıçap sınırlandırması (performans ve hız için 100m - 2000m)
    safe_radius = max(100, min(radius, 2500))

    # Kategori Filtreleme Sorgusu
    if category == "food":
        cat_filter = """
          node["name"]["amenity"~"restaurant|cafe|fast_food|bakery|bar|pub|ice_cream"](around:{radius},{lat},{lon});
          node["name"]["shop"~"bakery|pastry|deli|confectionery"](around:{radius},{lat},{lon});
        """
    elif category == "beauty":
        cat_filter = """
          node["name"]["shop"~"hairdresser|beauty|barber|tattoo"](around:{radius},{lat},{lon});
          node["name"]["amenity"~"spa"](around:{radius},{lat},{lon});
        """
    elif category == "auto":
        cat_filter = """
          node["name"]["shop"~"car_repair|car_parts|tyres|motorcycle_repair"](around:{radius},{lat},{lon});
          node["name"]["amenity"~"car_wash"](around:{radius},{lat},{lon});
          node["name"]["craft"~"car_repair"](around:{radius},{lat},{lon});
        """
    elif category == "retail":
        cat_filter = """
          node["name"]["shop"](around:{radius},{lat},{lon});
        """
    elif category == "health":
        cat_filter = """
          node["name"]["amenity"~"pharmacy|dentist|doctors|hospital|veterinary"](around:{radius},{lat},{lon});
          node["name"]["healthcare"](around:{radius},{lat},{lon});
        """
    elif category == "services":
        cat_filter = """
          node["name"]["office"](around:{radius},{lat},{lon});
          node["name"]["craft"](around:{radius},{lat},{lon});
          node["name"]["tourism"~"hotel"](around:{radius},{lat},{lon});
        """
    else: # all (tam tarama)
        cat_filter = """
          node["name"]["shop"](around:{radius},{lat},{lon});
          node["name"]["amenity"](around:{radius},{lat},{lon});
          node["name"]["craft"](around:{radius},{lat},{lon});
          node["name"]["office"](around:{radius},{lat},{lon});
          node["name"]["healthcare"](around:{radius},{lat},{lon});
          node["name"]["tourism"](around:{radius},{lat},{lon});
        """

    query = f"""[out:json][timeout:25];
    (
      {cat_filter.format(radius=safe_radius, lat=lat, lon=lon)}
    );
    out body 250;"""

    headers = {
        "User-Agent": "EsnafRadarApp/2.0 (destek@esnafradar.com)"
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for url in OVERPASS_URLS:
            try:
                # GET ile params kullanarak gönderim (Overpass kuyruğunda çok daha hızlıdır)
                response = await client.get(url, params={"data": query}, headers=headers)
                if response.status_code != 200:
                    # Alternatif olarak POST dene
                    response = await client.post(url, data=query, headers=headers)
                
                response.raise_for_status()
                data = response.json()
                
                results = []
                for element in data.get("elements", []):
                    tags = element.get("tags", {})
                    name = tags.get("name")
                    if not name or len(name.strip()) < 2:
                        continue
                    
                    raw_cat, label, group, icon = get_category_info(tags)
                    
                    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("mobile")
                    email = tags.get("email") or tags.get("contact:email")
                    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
                    instagram = tags.get("contact:instagram") or tags.get("instagram")
                    opening_hours = tags.get("opening_hours")
                    address = format_address(tags)

                    score, badge = calculate_opportunity(phone, website, instagram)

                    results.append({
                        "osm_id": str(element.get("id")),
                        "name": name.strip(),
                        "latitude": element.get("lat"),
                        "longitude": element.get("lon"),
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
                    })

                # Sonuçları fırsat puanına göre yüksekten düşüğe sırala
                results.sort(key=lambda x: x["lead_potential_score"], reverse=True)
                return results

            except Exception as e:
                logging.warning(f"Overpass sunucusu yanıt vermedi ({url}): {e}")
                continue

        raise HTTPException(
            status_code=503,
            detail="Harita tarama sunucuları şu an yoğun. Lütfen birkaç saniye sonra tekrar deneyin."
        )
