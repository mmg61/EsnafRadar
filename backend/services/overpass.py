import httpx
import logging
from fastapi import HTTPException

# Overpass API sunucuları (Hata durumunda diğerine geçer)
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]

async def search_merchants(lat: float, lon: float, radius: int, category: str = "shop"):
    query = f"""
    [out:json][timeout:25];
    (
      node["shop"](around:{radius},{lat},{lon});
      node["amenity"](around:{radius},{lat},{lon});
    );
    out body;
    """
    
    if category != "all":
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="{category}"](around:{radius},{lat},{lon});
          node["shop"="{category}"](around:{radius},{lat},{lon});
        );
        out body;
        """

    headers = {
        "User-Agent": "EsnafRadarApp/1.0 (test@esnafradar.com)"
    }
    
    async with httpx.AsyncClient() as client:
        for url in OVERPASS_URLS:
            try:
                response = await client.post(url, data=query, headers=headers, timeout=20.0)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for element in data.get("elements", []):
                    tags = element.get("tags", {})
                    name = tags.get("name")
                    if not name:
                        continue
                    
                    cat = tags.get("shop") or tags.get("amenity", "Bilinmeyen")
                    results.append({
                        "osm_id": str(element.get("id")),
                        "name": name,
                        "latitude": element.get("lat"),
                        "longitude": element.get("lon"),
                        "category": cat,
                        "phone": tags.get("phone") or tags.get("contact:phone"),
                        "email": tags.get("email") or tags.get("contact:email"),
                        "website": tags.get("website") or tags.get("contact:website"),
                        "address": f"{tags.get('addr:street', '')} {tags.get('addr:housenumber', '')}, {tags.get('addr:city', '')}".strip(" ,"),
                    })
                return results
            except Exception as e:
                logging.warning(f"Overpass API hatası ({url}): {e}")
                continue # Diğer URL'yi dene
        
        # Tüm URL'ler başarısız olduysa
        raise HTTPException(status_code=503, detail="Harita sunucuları şu an çok yoğun. Lütfen 30 saniye sonra tekrar deneyin.")
