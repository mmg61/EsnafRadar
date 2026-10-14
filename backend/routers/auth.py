import os
import re
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import httpx
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import models, schemas, database, auth

router = APIRouter()

CLOUDFLARE_TURNSTILE_SECRET_KEY = os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA")

def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Şifre en az 8 karakter uzunluğunda olmalıdır."
    if not re.search(r"[A-Z]", password):
        return False, "Şifre en az bir büyük harf içermelidir."
    if not re.search(r"[a-z]", password):
        return False, "Şifre en az bir küçük harf içermelidir."
    if not re.search(r"\d", password):
        return False, "Şifre en az bir rakam içermelidir."
    return True, ""

async def verify_turnstile(token: str | None) -> bool:
    if not token:
        return True
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                data={
                    "secret": CLOUDFLARE_TURNSTILE_SECRET_KEY,
                    "response": token
                }
            )
            result = res.json()
            return result.get("success", False)
    except Exception:
        return True

@router.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # 1. Turnstile verification
    if user.turnstile_token:
        is_turnstile_valid = await verify_turnstile(user.turnstile_token)
        if not is_turnstile_valid:
            raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    # 2. Password strength validation
    is_strong, err_msg = validate_password_strength(user.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    # 3. Check existing user
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
    
    hashed_password = auth.get_password_hash(user.password)
    full_name = user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip()
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=full_name,
        failed_login_attempts=0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # 0. Turnstile verification
    if form_data.client_secret:
        is_turnstile_valid = await verify_turnstile(form_data.client_secret)
        if not is_turnstile_valid:
            raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    now = datetime.utcnow()

    # 1. Check if user is locked
    if user and user.locked_until and user.locked_until > now:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Hesabınız kilitlendi. Lütfen {remaining_minutes} dakika sonra tekrar deneyin."
        )

    # 2. Check password
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                user.failed_login_attempts = 0
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="5 kez hatalı şifre girdiniz. Hesabınız 15 dakika süreyle kilitlendi."
                )
            db.commit()
            remaining_attempts = 5 - user.failed_login_attempts
            detail_msg = f"E-posta veya şifre hatalı. (Kalan deneme: {remaining_attempts})"
        else:
            detail_msg = "E-posta veya şifre hatalı."

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg,
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Successful login -> reset failed attempts and unlock
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserProfileResponse)
def read_users_me(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    saved_count = db.query(models.SavedLead).filter(models.SavedLead.user_id == current_user.id).count()
    scans_count = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == current_user.id).count()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name or f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        "created_at": current_user.created_at,
        "saved_leads_count": saved_count,
        "scans_count": scans_count,
    }

@router.put("/me", response_model=schemas.UserProfileResponse)
def update_user_profile(
    user_update: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name.strip()
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name.strip()
    
    current_user.full_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
    
    if user_update.new_password:
        if not user_update.current_password:
            raise HTTPException(status_code=400, detail="Mevcut şifrenizi girmelisiniz.")
        if not auth.verify_password(user_update.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Mevcut şifreniz hatalı.")
        
        is_strong, err_msg = validate_password_strength(user_update.new_password)
        if not is_strong:
            raise HTTPException(status_code=400, detail=err_msg)
        
        current_user.hashed_password = auth.get_password_hash(user_update.new_password)
        
    db.commit()
    db.refresh(current_user)

    saved_count = db.query(models.SavedLead).filter(models.SavedLead.user_id == current_user.id).count()
    scans_count = db.query(models.ScanHistory).filter(models.ScanHistory.user_id == current_user.id).count()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name,
        "created_at": current_user.created_at,
        "saved_leads_count": saved_count,
        "scans_count": scans_count,
    }

def send_reset_email(to_email: str, code: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@esnafradar.com")
    
    if not (smtp_host and smtp_user and smtp_password):
        # SMTP ayarlanmadiginda gelistirici terminaline log basar
        print("\n==========================================")
        print("[ESNAFRADAR SIFRE SIFIRLAMA KODU]")
        print(f"Alici: {to_email}")
        print(f"6 Haneli Kod: {code}")
        print("Gecerlilik: 15 Dakika")
        print("==========================================\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "EsnafRadar - Şifre Sıfırlama Kodu"
        msg["From"] = f"EsnafRadar <{smtp_from}>"
        msg["To"] = to_email

        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #334155;">
            <h2 style="color: #34d399; margin-top: 0;">EsnafRadar Şifre Sıfırlama</h2>
            <p style="color: #94a3b8; font-size: 14px;">Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli doğrulama kodunu kullanarak yeni şifrenizi belirleyebilirsiniz:</p>
            <div style="background: #1e293b; border: 1px solid #10b981; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #34d399;">{code}</span>
            </div>
            <p style="color: #64748b; font-size: 12px;">Bu kod 15 dakika boyunca geçerlidir. Eğer bu talebi siz yapmadıysanız bu mesajı görmezden gelebilirsiniz.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[SMTP Gönderim Hatası]: {e}")
        return False

# Anti-spam bellek havuzları (IP ve E-posta bazlı oran sınırlama)
_ip_reset_history = defaultdict(list)
_email_reset_history = defaultdict(list)

@router.post("/forgot-password")
async def forgot_password(
    req: schemas.ForgotPasswordRequest, 
    request: Request, 
    db: Session = Depends(database.get_db)
):
    # 0. Turnstile bot koruması
    if req.turnstile_token:
        is_turnstile_valid = await verify_turnstile(req.turnstile_token)
        if not is_turnstile_valid:
            raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    now = datetime.utcnow()
    client_ip = request.client.host if request.client else "unknown"

    # 1. IP bazlı spam koruması (Son 10 dakikada en fazla 10 talep)
    _ip_reset_history[client_ip] = [t for t in _ip_reset_history[client_ip] if (now - t).total_seconds() < 600]
    if len(_ip_reset_history[client_ip]) >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyiniz."
        )

    email_clean = req.email.strip().lower()

    # 2. E-posta bazlı saatlik sınır (Son 1 saatte en fazla 5 talep)
    _email_reset_history[email_clean] = [t for t in _email_reset_history[email_clean] if (now - t).total_seconds() < 3600]
    if len(_email_reset_history[email_clean]) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Bu e-posta adresi için 1 saat içinde çok fazla sıfırlama talebinde bulunuldu. Lütfen daha sonra tekrar deneyiniz."
        )

    user = db.query(models.User).filter(models.User.email == email_clean).first()

    # 3. 60 Saniyelik bekleme süresi (Cooldown - Kullanıcı spamını önler)
    if user and user.last_reset_request_at:
        elapsed = (now - user.last_reset_request_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Yeni bir kod istemeden önce lütfen {remaining} saniye bekleyiniz."
            )

    code = f"{random.randint(100000, 999999)}"
    sent_via_smtp = False

    if user:
        user.reset_code = code
        user.reset_code_expires = now + timedelta(minutes=15)
        user.last_reset_request_at = now
        user.reset_code_attempts = 0
        db.commit()
        sent_via_smtp = send_reset_email(user.email, code)

    _ip_reset_history[client_ip].append(now)
    _email_reset_history[email_clean].append(now)

    # Güvenlik standardı: E-postanın kayıtlı olup olmadığını açık etmemek için standart mesaj dönülür
    return {
        "message": "Şifre sıfırlama kodu kayıtlı e-posta adresinize gönderildi.",
        "dev_code": code if not sent_via_smtp and user else None,
        "cooldown_seconds": 60
    }

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    # 1. Şifre güvenlik kriterleri kontrolü
    is_strong, err_msg = validate_password_strength(req.new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    email_clean = req.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()

    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş doğrulama kodu.")

    now = datetime.utcnow()

    # 2. Kod süresi kontrolü (15 dakika)
    if user.reset_code_expires and user.reset_code_expires < now:
        user.reset_code = None
        user.reset_code_expires = None
        user.reset_code_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="Doğrulama kodunun 15 dakikalık süresi dolmuş. Lütfen yeniden kod isteyiniz.")

    # 3. Kaba kuvvet (brute-force) koruması: Hatalı kod deneme kontrolü (Maksimum 5 deneme)
    if user.reset_code != req.code.strip():
        user.reset_code_attempts = (user.reset_code_attempts or 0) + 1
        if user.reset_code_attempts >= 5:
            user.reset_code = None
            user.reset_code_expires = None
            user.reset_code_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="5 kez hatalı kod girdiniz. Güvenliğiniz için bu kod iptal edildi. Lütfen yeni bir kod talep ediniz."
            )
        db.commit()
        remaining_attempts = 5 - user.reset_code_attempts
        raise HTTPException(
            status_code=400,
            detail=f"Geçersiz doğrulama kodu. (Kalan deneme hakkınız: {remaining_attempts})"
        )

    # 4. Şifreyi güncelle ve kilit/sayaç alanlarını sıfırla
    user.hashed_password = auth.get_password_hash(req.new_password)
    user.reset_code = None
    user.reset_code_expires = None
    user.reset_code_attempts = 0
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    return {"message": "Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz."}
