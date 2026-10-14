from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import database, models, schemas, auth

router = APIRouter()

@router.post("/save", response_model=schemas.SavedLeadResponse)
def save_lead(
    request: schemas.LeadSaveRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Bir esnafı kullanıcının Kişisel Lead Listesi'ne (CRM) kaydeder.
    Eğer esnaf merchants tablosunda yoksa önce oluşturur, varsa günceller.
    """
    # 1. Merchant tablosunda var mı?
    merchant = db.query(models.Merchant).filter(models.Merchant.osm_id == request.osm_id).first()
    
    if not merchant:
        merchant = models.Merchant(
            osm_id=request.osm_id,
            name=request.name,
            latitude=request.latitude,
            longitude=request.longitude,
            category=request.category,
            phone=request.phone,
            email=request.email,
            website=request.website,
            address=request.address,
            audit_data=request.audit_data,
            last_scanned_at=datetime.utcnow()
        )
        db.add(merchant)
        db.commit()
        db.refresh(merchant)
    else:
        # Bilgileri ve röntgen verisini güncelle
        if request.audit_data:
            merchant.audit_data = request.audit_data
        if request.phone and not merchant.phone:
            merchant.phone = request.phone
        if request.website and not merchant.website:
            merchant.website = request.website
        if request.address and not merchant.address:
            merchant.address = request.address
        merchant.last_scanned_at = datetime.utcnow()
        db.commit()
        db.refresh(merchant)

    # 2. Kullanıcı zaten bu esnafı kaydetmiş mi?
    existing_lead = db.query(models.SavedLead).filter(
        models.SavedLead.user_id == current_user.id,
        models.SavedLead.merchant_id == merchant.id
    ).first()

    if existing_lead:
        # Skor veya audit güncellendiyse güncelle
        if request.opportunity_score is not None:
            existing_lead.opportunity_score = request.opportunity_score
        db.commit()
        db.refresh(existing_lead)
        return existing_lead

    # 3. Yeni SavedLead oluştur
    new_lead = models.SavedLead(
        user_id=current_user.id,
        merchant_id=merchant.id,
        status="new",
        opportunity_score=request.opportunity_score or 0,
        saved_at=datetime.utcnow()
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead


@router.get("", response_model=List[schemas.SavedLeadResponse])
def get_saved_leads(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Oturum açmış kullanıcının tüm kayıtlı lead'lerini döndürür.
    """
    leads = db.query(models.SavedLead).filter(
        models.SavedLead.user_id == current_user.id
    ).order_by(models.SavedLead.saved_at.desc()).all()
    
    return leads


@router.patch("/{lead_id}/status", response_model=schemas.SavedLeadResponse)
def update_lead_status(
    lead_id: int,
    request: schemas.LeadStatusUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Lead'in durumunu günceller (new, contacted, interested, converted, rejected).
    """
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı lead bulunamadı")

    lead.status = request.status
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Lead'i kullanıcının listesinden siler.
    """
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı lead bulunamadı")

    db.delete(lead)
    db.commit()
    return None
