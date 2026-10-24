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
        and "cms_platform" in existing_merchant.audit_data
        and "recommended_package" in existing_merchant.audit_data
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
        if not existing_merchant.website and audit_result.get("discovered_website"):
            existing_merchant.website = audit_result["discovered_website"]
        if not existing_merchant.email and audit_result.get("scraped_emails"):
            existing_merchant.email = audit_result["scraped_emails"][0]
        if not existing_merchant.phone and audit_result.get("scraped_phones"):
            existing_merchant.phone = audit_result["scraped_phones"][0]
        db.commit()
    
    return audit_result


@router.get("/ai-status", response_model=schemas.AIStatusResponse)
def get_ai_status(
    current_user: models.User = Depends(auth.get_current_user)
):
    from services.pitch_generator import get_gemini_status
    return get_gemini_status()


@router.post("/ai-config", response_model=schemas.AIStatusResponse)
def update_ai_config(
    request: schemas.AIConfigRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    from services.pitch_generator import save_gemini_api_key
    return save_gemini_api_key(request.api_key)


@router.post("/generate-pitch", response_model=schemas.PitchGenerateResponse)
async def generate_custom_pitch(
    request: schemas.PitchGenerateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    from services.pitch_generator import generate_personalized_pitch

    sender_name = request.sender_name
    if not sender_name:
        if current_user.full_name:
            sender_name = current_user.full_name
        elif current_user.first_name or current_user.last_name:
            sender_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()

    pitch_result = await generate_personalized_pitch(
        merchant_name=request.merchant_name,
        category=request.category,
        tone=request.tone,
        focus_service=request.focus_service,
        sender_name=sender_name,
        agency_name=request.agency_name,
        special_offer=request.special_offer,
        custom_instruction=request.custom_instruction,
        audit_context=request.audit_context if isinstance(request.audit_context, dict) else {},
        gemini_api_key=request.gemini_api_key,
    )

    if request.osm_id:
        existing_merchant = db.query(models.Merchant).filter(models.Merchant.osm_id == request.osm_id).first()
        if existing_merchant and isinstance(existing_merchant.audit_data, dict):
            updated_audit = dict(existing_merchant.audit_data)
            updated_audit["ai_engine_used"] = pitch_result.get("engine_used", "smart_hybrid_ai")
            updated_audit["recommended_package"] = pitch_result.get("recommended_package")
            updated_audit["detected_pain_points"] = pitch_result.get("detected_pain_points", [])
            updated_audit["value_propositions"] = pitch_result.get("value_propositions", [])
            updated_audit["sales_pitch_whatsapp"] = pitch_result.get("whatsapp_pitch")
            updated_audit["email_subject"] = pitch_result.get("email_subject")
            updated_audit["sales_pitch_email"] = pitch_result.get("email_pitch")
            updated_audit["instagram_dm_pitch"] = pitch_result.get("instagram_dm_pitch")
            updated_audit["cold_call_script"] = pitch_result.get("cold_call_script")
            existing_merchant.audit_data = updated_audit
            db.commit()

    return pitch_result
