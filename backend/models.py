from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    saved_leads = relationship("SavedLead", back_populates="user")
    scan_history = relationship("ScanHistory", back_populates="user")


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    category = Column(String)
    
    phone = Column(String)
    email = Column(String)
    website = Column(String)
    address = Column(String)
    
    audit_data = Column(JSON) # Dijital röntgen sonuçları
    last_scanned_at = Column(DateTime, default=datetime.utcnow)
    
    saved_leads = relationship("SavedLead", back_populates="merchant")


class SavedLead(Base):
    __tablename__ = "saved_leads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    
    status = Column(String, default="new") # new, contacted, interested, converted, rejected
    opportunity_score = Column(Integer, default=0)
    saved_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_leads")
    merchant = relationship("Merchant", back_populates="saved_leads")
    notes = relationship("LeadNote", back_populates="saved_lead")
    outreach_logs = relationship("OutreachLog", back_populates="saved_lead")


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id = Column(Integer, primary_key=True, index=True)
    saved_lead_id = Column(Integer, ForeignKey("saved_leads.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    saved_lead = relationship("SavedLead", back_populates="notes")


class OutreachLog(Base):
    __tablename__ = "outreach_logs"

    id = Column(Integer, primary_key=True, index=True)
    saved_lead_id = Column(Integer, ForeignKey("saved_leads.id"))
    channel = Column(String) # WhatsApp, Email
    message_content = Column(Text)
    is_ai_generated = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    saved_lead = relationship("SavedLead", back_populates="outreach_logs")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    search_lat = Column(Float)
    search_lng = Column(Float)
    radius_meters = Column(Integer)
    category_filter = Column(String)
    results_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="scan_history")
