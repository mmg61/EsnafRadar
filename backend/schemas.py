from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    turnstile_token: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    created_at: datetime
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

    class Config:
        from_attributes = True

class UserProfileResponse(UserResponse):
    saved_leads_count: int = 0
    scans_count: int = 0

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- Merchant Schemas ---
class MerchantBase(BaseModel):
    osm_id: str
    name: str
    latitude: float
    longitude: float
    category: Optional[str] = None
    category_group: Optional[str] = None
    category_label: Optional[str] = None
    category_icon: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    opening_hours: Optional[str] = None
    address: Optional[str] = None
    opportunity_badge: Optional[str] = None
    lead_potential_score: Optional[int] = 0

class MerchantCreate(MerchantBase):
    pass

class AuditRequest(BaseModel):
    osm_id: str
    name: str
    website: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    force_refresh: Optional[bool] = False

class AuditResponse(BaseModel):
    score: int
    ssl_valid: bool
    mobile_ready: bool
    has_website: bool
    http_status: Optional[int] = None
    response_time_ms: Optional[int] = None
    has_title: Optional[bool] = False
    page_title: Optional[str] = None
    has_meta_description: Optional[bool] = False
    has_h1: Optional[bool] = False
    has_analytics: Optional[bool] = False
    has_pixel: Optional[bool] = False
    scraped_emails: List[str] = []
    scraped_phones: List[str] = []
    social_links: dict[str, str] = {}
    ai_summary: str
    opportunities: List[str]
    sales_pitch_whatsapp: Optional[str] = None
    sales_pitch_email: Optional[str] = None

class ScanHistoryResponse(BaseModel):
    id: int
    search_lat: float
    search_lng: float
    radius_meters: int
    category_filter: Optional[str] = "all"
    results_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class MerchantResponse(MerchantBase):
    id: int
    audit_data: Optional[Any] = None
    last_scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Lead CRM Schemas ---
class LeadSaveRequest(BaseModel):
    osm_id: str
    name: str
    latitude: float
    longitude: float
    category: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    opportunity_score: Optional[int] = 0
    audit_data: Optional[Any] = None

class LeadStatusUpdate(BaseModel):
    status: str

class LeadNoteCreate(BaseModel):
    content: str

class LeadNoteUpdate(BaseModel):
    content: str

class LeadNoteResponse(BaseModel):
    id: int
    saved_lead_id: int
    user_id: int
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class OutreachLogCreate(BaseModel):
    channel: str
    message_content: str
    is_ai_generated: Optional[bool] = False

class OutreachLogResponse(BaseModel):
    id: int
    saved_lead_id: int
    channel: str
    message_content: str
    is_ai_generated: bool
    sent_at: datetime

    class Config:
        from_attributes = True

class SavedLeadResponse(BaseModel):
    id: int
    user_id: int
    merchant_id: int
    status: str
    opportunity_score: int
    saved_at: datetime
    merchant: MerchantResponse
    notes: List[LeadNoteResponse] = []
    outreach_logs: List[OutreachLogResponse] = []

    class Config:
        from_attributes = True
