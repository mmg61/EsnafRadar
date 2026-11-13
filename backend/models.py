from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    full_name = Column(String)
    gemini_api_key = Column(String, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    reset_code = Column(String, nullable=True)
    reset_code_expires = Column(DateTime, nullable=True)
    last_reset_request_at = Column(DateTime, nullable=True)
    reset_code_attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    saved_leads = relationship("SavedLead", back_populates="user", cascade="all, delete-orphan")


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

    audit_data = Column(JSON)
    last_scanned_at = Column(DateTime, default=datetime.utcnow)

    saved_leads = relationship("SavedLead", back_populates="merchant")


class SavedLead(Base):
    __tablename__ = "saved_leads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    merchant_id = Column(Integer, ForeignKey("merchants.id"))

    status = Column(String, default="new")
    opportunity_score = Column(Integer, default=0)
    saved_at = Column(DateTime, default=datetime.utcnow)

    reminder_at = Column(DateTime, nullable=True)
    reminder_note = Column(String, nullable=True)
    reminder_completed = Column(Boolean, default=False)

    user = relationship("User", back_populates="saved_leads")
    merchant = relationship("Merchant", back_populates="saved_leads")
    notes = relationship("LeadNote", back_populates="saved_lead", cascade="all, delete-orphan", order_by="desc(LeadNote.created_at)")
    outreach_logs = relationship("OutreachLog", back_populates="saved_lead", cascade="all, delete-orphan", order_by="desc(OutreachLog.sent_at)")


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
    channel = Column(String)
    message_content = Column(Text)
    is_ai_generated = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=datetime.utcnow)

    saved_lead = relationship("SavedLead", back_populates="outreach_logs")


class RateLimitLog(Base):
    __tablename__ = "rate_limit_logs"

    id = Column(Integer, primary_key=True, index=True)
    bucket = Column(String, index=True, nullable=False)
    identifier = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

