from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Literal
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    full_name: Optional[str] = Field(None, max_length=160)
    turnstile_token: Optional[str] = Field(None, max_length=2048)

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

class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    current_password: Optional[str] = Field(None, max_length=128)
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = Field(None, max_length=2048)

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- Merchant Schemas ---
class MerchantBase(BaseModel):
    osm_id: str = Field(..., max_length=64)
    name: str = Field(..., min_length=1, max_length=200)
    latitude: float
    longitude: float
    category: Optional[str] = Field(None, max_length=100)
    category_group: Optional[str] = Field(None, max_length=60)
    category_label: Optional[str] = Field(None, max_length=120)
    category_icon: Optional[str] = Field(None, max_length=32)
    phone: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=160)
    website: Optional[str] = Field(None, max_length=500)
    website_source: Optional[str] = Field(None, max_length=64)
    is_corporate_chain: Optional[bool] = False
    instagram: Optional[str] = Field(None, max_length=200)
    opening_hours: Optional[str] = Field(None, max_length=250)
    address: Optional[str] = Field(None, max_length=400)
    opportunity_badge: Optional[str] = Field(None, max_length=120)
    lead_potential_score: Optional[int] = 0

class MerchantCreate(MerchantBase):
    pass

class AuditRequest(BaseModel):
    osm_id: str = Field(..., max_length=64)
    name: str = Field(..., min_length=1, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=64)
    category: Optional[str] = Field(None, max_length=120)
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
    api_key: str = Field("", max_length=256)


class AIStatusResponse(BaseModel):
    configured: bool
    masked_key: Optional[str] = None
    model: str = "gemini-2.5-flash"


class PitchGenerateRequest(BaseModel):
    osm_id: Optional[str] = Field(None, max_length=64)
    merchant_name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=120)
    tone: Literal["kurumsal", "samimi", "ikna_edici", "kisa_net"] = "kurumsal"
    focus_service: Literal["auto", "web_tasarim", "yerel_seo", "performans_reklam", "e_ticaret"] = "auto"
    sender_name: Optional[str] = Field(None, max_length=120)
    agency_name: Optional[str] = Field(None, max_length=120)
    special_offer: Optional[str] = Field(None, max_length=250)
    custom_instruction: Optional[str] = Field(None, max_length=500)
    audit_context: Optional[Any] = None
    gemini_api_key: Optional[str] = Field(None, max_length=256)


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

class MerchantResponse(MerchantBase):
    id: int
    audit_data: Optional[Any] = None
    last_scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Lead CRM Schemas ---
LeadStatusLiteral = Literal["new", "contacted", "interested", "converted", "rejected"]
OutreachChannelLiteral = Literal["WhatsApp", "Email", "Instagram", "Phone"]

class LeadSaveRequest(BaseModel):
    osm_id: str = Field(..., max_length=64)
    name: str = Field(..., min_length=1, max_length=200)
    latitude: float
    longitude: float
    category: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=160)
    website: Optional[str] = Field(None, max_length=500)
    address: Optional[str] = Field(None, max_length=400)
    opportunity_score: Optional[int] = Field(0, ge=0, le=100)
    audit_data: Optional[Any] = None

class LeadStatusUpdate(BaseModel):
    status: LeadStatusLiteral

class LeadReminderUpdate(BaseModel):
    reminder_at: Optional[datetime] = None
    reminder_note: Optional[str] = Field(None, max_length=300)
    reminder_completed: Optional[bool] = False

class LeadNoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class LeadNoteUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

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
    channel: OutreachChannelLiteral
    message_content: str = Field(..., min_length=1, max_length=5000)
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
    reminder_at: Optional[datetime] = None
    reminder_note: Optional[str] = None
    reminder_completed: Optional[bool] = False
    merchant: MerchantResponse
    notes: List[LeadNoteResponse] = []
    outreach_logs: List[OutreachLogResponse] = []

    class Config:
        from_attributes = True


class PdfExportRequest(BaseModel):
    merchant_name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=120)
    website: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=160)
    score: Optional[int] = Field(0, ge=0, le=100)
    has_website: Optional[bool] = False
    ssl_valid: Optional[bool] = False
    mobile_ready: Optional[bool] = False
    has_title: Optional[bool] = False
    has_meta_description: Optional[bool] = False
    has_h1: Optional[bool] = False
    has_og_tags: Optional[bool] = False
    has_schema: Optional[bool] = False
    has_analytics: Optional[bool] = False
    has_pixel: Optional[bool] = False
    ai_summary: Optional[str] = Field(None, max_length=3000)
    recommended_package: Optional[str] = Field(None, max_length=300)
    detected_pain_points: List[str] = []
    opportunities: List[str] = []
    value_propositions: List[str] = []
    whatsapp_pitch: Optional[str] = Field(None, max_length=4000)
    sales_pitch_whatsapp: Optional[str] = Field(None, max_length=4000)


class DemoSiteRequest(BaseModel):
    merchant_name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=160)
    address: Optional[str] = Field(None, max_length=400)
    opening_hours: Optional[str] = Field(None, max_length=250)
    instagram: Optional[str] = Field(None, max_length=200)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DemoSiteResponse(BaseModel):
    merchant_name: str
    html_content: str
