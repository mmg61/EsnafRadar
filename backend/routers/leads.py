import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Any
from datetime import datetime

import database, models, schemas, auth

router = APIRouter()

STATUS_LABELS_TR = {
    "new": "Yeni",
    "contacted": "İletişime Geçildi",
    "interested": "İlgileniyor",
    "converted": "Satış Yapıldı",
    "rejected": "Reddedildi"
}


def _sanitize_csv_cell(val: Any) -> str:
    """
    CSV Enjeksiyon (Formula Injection) Koruması:
    Excel veya LibreOffice Calc'ta formül olarak çalıştırılabilecek (=, +, -, @, Tab, CR)
    karakterlerle başlayan hücrelerin başına tek tırnak (') ekler.
    """
    if val is None:
        return ""
    text = str(val).replace("\r", " ").replace("\n", " ").strip()
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text}"
    return text


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
    scraped_email = None
    scraped_phone = None
    if isinstance(request.audit_data, dict):
        emails = request.audit_data.get("scraped_emails") or []
        phones = request.audit_data.get("scraped_phones") or []
        if emails:
            scraped_email = emails[0]
        if phones:
            scraped_phone = phones[0]

    resolved_phone = request.phone or scraped_phone
    resolved_email = request.email or scraped_email

    merchant = db.query(models.Merchant).filter(models.Merchant.osm_id == request.osm_id).first()

    if not merchant:
        merchant = models.Merchant(
            osm_id=request.osm_id,
            name=request.name,
            latitude=request.latitude,
            longitude=request.longitude,
            category=request.category,
            phone=resolved_phone,
            email=resolved_email,
            website=request.website,
            address=request.address,
            audit_data=request.audit_data,
            last_scanned_at=datetime.utcnow()
        )
        db.add(merchant)
        db.commit()
        db.refresh(merchant)
    else:
        if request.audit_data:
            merchant.audit_data = request.audit_data
        if resolved_phone and not merchant.phone:
            merchant.phone = resolved_phone
        if resolved_email and not merchant.email:
            merchant.email = resolved_email
        if request.website and not merchant.website:
            merchant.website = request.website
        if request.address and not merchant.address:
            merchant.address = request.address
        merchant.last_scanned_at = datetime.utcnow()
        db.commit()
        db.refresh(merchant)

    existing_lead = db.query(models.SavedLead).filter(
        models.SavedLead.user_id == current_user.id,
        models.SavedLead.merchant_id == merchant.id
    ).first()

    if existing_lead:
        if request.opportunity_score is not None:
            existing_lead.opportunity_score = request.opportunity_score
        db.commit()
        db.refresh(existing_lead)
        return existing_lead

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
    skip: int = Query(0, ge=0, description="Atlanacak kayıt sayısı"),
    limit: int = Query(100, ge=1, le=500, description="Sayfa başına azami kayıt sayısı"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Oturum açmış kullanıcının kayıtlı müşteri adaylarını sayfalı olarak döndürür.
    """
    leads = (
        db.query(models.SavedLead)
        .filter(models.SavedLead.user_id == current_user.id)
        .order_by(models.SavedLead.saved_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return leads


@router.get("/export/csv")
def export_saved_leads_csv(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Kayıtlı tüm müşteri adaylarını CSV Injection korumalı ve Excel uyumlu UTF-8 BOM CSV formatında dışa aktarır.
    """
    leads = db.query(models.SavedLead).filter(
        models.SavedLead.user_id == current_user.id
    ).order_by(models.SavedLead.saved_at.desc()).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")

    writer.writerow([
        "İşletme Adı",
        "Sektör",
        "Satış Aşaması",
        "Fırsat Puanı",
        "Telefon",
        "E-posta",
        "Web Sitesi",
        "Adres",
        "Hatırlatıcı Tarihi",
        "Hatırlatıcı Notu",
        "Not Sayısı",
        "Son Not",
        "İletişim Sayısı",
        "Kaydedilme Tarihi"
    ])

    for lead in leads:
        m = lead.merchant
        notes_count = len(lead.notes or [])
        last_note = lead.notes[0].content if notes_count > 0 else ""
        outreach_count = len(lead.outreach_logs or [])
        saved_date = lead.saved_at.strftime("%Y-%m-%d %H:%M") if lead.saved_at else ""
        reminder_date = lead.reminder_at.strftime("%Y-%m-%d %H:%M") if lead.reminder_at else ""
        reminder_note = lead.reminder_note or ""
        writer.writerow([
            _sanitize_csv_cell(m.name if m else ""),
            _sanitize_csv_cell((m.category or "Genel") if m else ""),
            _sanitize_csv_cell(STATUS_LABELS_TR.get(lead.status, lead.status)),
            lead.opportunity_score,
            _sanitize_csv_cell((m.phone or "") if m else ""),
            _sanitize_csv_cell((m.email or "") if m else ""),
            _sanitize_csv_cell((m.website or "") if m else ""),
            _sanitize_csv_cell((m.address or "") if m else ""),
            _sanitize_csv_cell(reminder_date),
            _sanitize_csv_cell(reminder_note),
            notes_count,
            _sanitize_csv_cell(last_note),
            outreach_count,
            _sanitize_csv_cell(saved_date)
        ])

    output.seek(0)
    filename = f"esnafradar_musteriler_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.patch("/{lead_id}/status", response_model=schemas.SavedLeadResponse)
def update_lead_status(
    lead_id: int,
    request: schemas.LeadStatusUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
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


@router.patch("/{lead_id}/reminder", response_model=schemas.SavedLeadResponse)
def update_lead_reminder(
    lead_id: int,
    request: schemas.LeadReminderUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı müşteri bulunamadı.")

    lead.reminder_at = request.reminder_at
    lead.reminder_note = request.reminder_note.strip() if request.reminder_note else None
    lead.reminder_completed = bool(request.reminder_completed) if request.reminder_at else False

    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/notes", response_model=schemas.LeadNoteResponse)
def add_lead_note(
    lead_id: int,
    request: schemas.LeadNoteCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı müşteri bulunamadı.")

    content_clean = request.content.strip()
    if not content_clean:
        raise HTTPException(status_code=400, detail="Not içeriği boş olamaz.")

    note = models.LeadNote(
        saved_lead_id=lead.id,
        user_id=current_user.id,
        content=content_clean
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{lead_id}/notes/{note_id}", response_model=schemas.LeadNoteResponse)
def update_lead_note(
    lead_id: int,
    note_id: int,
    request: schemas.LeadNoteUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    note = db.query(models.LeadNote).filter(
        models.LeadNote.id == note_id,
        models.LeadNote.saved_lead_id == lead_id,
        models.LeadNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")

    content_clean = request.content.strip()
    if not content_clean:
        raise HTTPException(status_code=400, detail="Not içeriği boş olamaz.")

    note.content = content_clean
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{lead_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead_note(
    lead_id: int,
    note_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    note = db.query(models.LeadNote).filter(
        models.LeadNote.id == note_id,
        models.LeadNote.saved_lead_id == lead_id,
        models.LeadNote.user_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")

    db.delete(note)
    db.commit()
    return None


@router.post("/{lead_id}/outreach", response_model=schemas.OutreachLogResponse)
def log_lead_outreach(
    lead_id: int,
    request: schemas.OutreachLogCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı müşteri bulunamadı.")

    log_entry = models.OutreachLog(
        saved_lead_id=lead.id,
        channel=request.channel,
        message_content=request.message_content.strip(),
        is_ai_generated=bool(request.is_ai_generated),
        sent_at=datetime.utcnow()
    )
    db.add(log_entry)

    if lead.status == "new":
        lead.status = "contacted"

    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    lead = db.query(models.SavedLead).filter(
        models.SavedLead.id == lead_id,
        models.SavedLead.user_id == current_user.id
    ).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Kayıtlı lead bulunamadı")

    db.delete(lead)
    db.commit()
    return None
