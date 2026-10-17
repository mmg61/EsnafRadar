from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

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


@router.get("/history", response_model=List[schemas.ScanHistoryResponse])
def get_scan_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Kullanıcının son 20 bölgesel tarama geçmişini döndürür.
    """
    items = db.query(models.ScanHistory).filter(
        models.ScanHistory.user_id == current_user.id
    ).order_by(models.ScanHistory.created_at.desc()).limit(20).all()
    return items


@router.delete("/history/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan_history_item(
    scan_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.ScanHistory).filter(
        models.ScanHistory.id == scan_id,
        models.ScanHistory.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Tarama kaydı bulunamadı.")
    db.delete(item)
    db.commit()
    return None


@router.post("/audit", response_model=schemas.AuditResponse)
async def audit_merchant(
    request: schemas.AuditRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    from services.auditor import run_audit
    
    existing_merchant = db.query(models.Merchant).filter(models.Merchant.osm_id == request.osm_id).first()
    now = datetime.utcnow()

    # Önbellek kontrolü: Son 24 saat içinde denetlenmişse ve force_refresh istenmemişse önbellekten dön
    if (
        not request.force_refresh
        and existing_merchant
        and existing_merchant.audit_data
        and isinstance(existing_merchant.audit_data, dict)
        and "sales_pitch_whatsapp" in existing_merchant.audit_data
        and existing_merchant.last_scanned_at
        and (now - existing_merchant.last_scanned_at) < timedelta(hours=24)
    ):
        return existing_merchant.audit_data

    # Röntgeni çek
    audit_result = await run_audit(name=request.name, website=request.website, category=request.category)
    
    # Eğer bu esnaf veritabanında kayıtlıysa röntgen verisini ve kazınan iletişim bilgilerini önbellekle
    if existing_merchant:
        existing_merchant.audit_data = audit_result
        existing_merchant.last_scanned_at = now
        if not existing_merchant.email and audit_result.get("scraped_emails"):
            existing_merchant.email = audit_result["scraped_emails"][0]
        if not existing_merchant.phone and audit_result.get("scraped_phones"):
            existing_merchant.phone = audit_result["scraped_phones"][0]
        db.commit()
    
    return audit_result
