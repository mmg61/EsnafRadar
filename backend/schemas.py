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
    website_source: Optional[str] = None
    is_corporate_chain: Optional[bool] = False
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
    discovered_website: Optional[str] = None
    website_source: Optional[str] = None
    is_corporate_chain: Optional[bool] = False
    http_status: Optional[int] = None
    response_time_ms: Optional[int] = None
    has_title: Optional[bool] = False
    page_title: Optional[str] = None
    has_meta_description: Optional[bool] = False
    meta_description: Optional[str] = None
    has_h1: Optional[bool] = False
    h1_text: Optional[str] = None
    has_og_tags: Optional[bool] = False
    has_schema: Optional[bool] = False
    has_favicon: Optional[bool] = False
    has_analytics: Optional[bool] = False
    has_pixel: Optional[bool] = False
    cms_platform: Optional[str] = None
    crawled_pages: List[str] = []
    scraped_emails: List[str] = []
    scraped_phones: List[str] = []
    scraped_whatsapp: Optional[str] = None
    social_links: dict[str, str] = {}
    ai_summary: str
    opportunities: List[str]
    ai_engine_used: Optional[str] = "smart_hybrid_ai"
    recommended_package: Optional[str] = None
    detected_pain_points: List[str] = []
    value_propositions: List[str] = []
    sales_pitch_whatsapp: Optional[str] = None
    email_subject: Optional[str] = None
    sales_pitch_email: Optional[str] = None
    instagram_dm_pitch: Optional[str] = None
    cold_call_script: Optional[str] = None


class AIConfigRequest(BaseModel):
    api_key: str


class AIStatusResponse(BaseModel):
    configured: bool
    masked_key: Optional[str] = None
    model: str = "gemini-2.5-flash"


class PitchGenerateRequest(BaseModel):
    osm_id: Optional[str] = None
    merchant_name: str
    category: Optional[str] = None
    tone: str = "kurumsal"
    focus_service: str = "auto"
    sender_name: Optional[str] = None
    agency_name: Optional[str] = None
    special_offer: Optional[str] = None
    custom_instruction: Optional[str] = None
    audit_context: Optional[Any] = None
    gemini_api_key: Optional[str] = None


class PitchGenerateResponse(BaseModel):
    engine_used: str
    model_name: str
    recommended_package: str
    detected_pain_points: List[str] = []
    value_propositions: List[str] = []
    whatsapp_pitch: str
    email_subject: str
    email_pitch: str
    instagram_dm_pitch: str
    cold_call_script: str

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
