from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True

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
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None

class MerchantCreate(MerchantBase):
    pass

class AuditRequest(BaseModel):
    osm_id: str
    name: str
    website: Optional[str] = None
    phone: Optional[str] = None

class AuditResponse(BaseModel):
    score: int
    ssl_valid: bool
    mobile_ready: bool
    has_website: bool
    ai_summary: str
    opportunities: List[str]

class MerchantResponse(MerchantBase):
    id: int
    audit_data: Optional[Any] = None
    last_scanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True
