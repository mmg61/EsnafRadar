from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database, models, schemas, auth
from services.overpass import search_merchants

router = APIRouter()

@router.get("/scan", response_model=List[schemas.MerchantBase])
async def scan_area(
    lat: float, 
    lon: float, 
    radius: int = 1000, 
    category: str = "all", 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Belirtilen koordinat ve yarıçap etrafındaki esnafları bulur.
    Örn: lat=41.0082, lon=28.9784, radius=500
    """
    merchants = await search_merchants(lat=lat, lon=lon, radius=radius, category=category)
    
    # Tarama geçmişini kaydet
    history = models.ScanHistory(
        user_id=current_user.id,
        search_lat=lat,
        search_lng=lon,
        radius_meters=radius,
        category_filter=category,
        results_count=len(merchants)
    )
    db.add(history)
    db.commit()
    
    return merchants

@router.post("/audit", response_model=schemas.AuditResponse)
async def audit_merchant(
    request: schemas.AuditRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    from services.auditor import run_audit
    
    # Röntgeni çek
    audit_result = await run_audit(name=request.name, website=request.website)
    
    # Eğer bu esnaf db'de varsa güncelle, yoksa kaydetmek için lead eklemeyi bekleyebiliriz
    # Şimdilik sadece anlık analiz dönüyoruz
    
    return audit_result
