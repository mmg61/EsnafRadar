import os
import re
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import httpx
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import models, schemas, database, auth

router = APIRouter()

CLOUDFLARE_TURNSTILE_SECRET_KEY = os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "").strip()
ALLOW_DEV_TURNSTILE = os.getenv("ALLOW_DEV_TURNSTILE", "true").strip().lower() in ("1", "true", "yes")


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


def _check_rate_limit(db: Session, bucket: str, identifier: str, window_seconds: int, max_requests: int) -> bool:
    """Veritabanı destekli kalıcı istek sınırlama (Rate Limit) kontrolü."""
    cutoff = datetime.utcnow() - timedelta(seconds=window_seconds)
    db.query(models.RateLimitLog).filter(
        models.RateLimitLog.bucket == bucket,
        models.RateLimitLog.created_at < cutoff
    ).delete(synchronize_session=False)
    count = db.query(models.RateLimitLog).filter(
        models.RateLimitLog.bucket == bucket,
        models.RateLimitLog.identifier == identifier,
        models.RateLimitLog.created_at >= cutoff
    ).count()
    return count < max_requests


def _record_rate_limit_hit(db: Session, bucket: str, identifier: str) -> None:
    db.add(models.RateLimitLog(bucket=bucket, identifier=identifier, created_at=datetime.utcnow()))
    db.commit()


async def verify_turnstile(token: str | None) -> bool:
    # Gerçek bir Turnstile gizli anahtarı tanımlanmamışsa ve yerel geliştirme izni açıksa geçer
    if not CLOUDFLARE_TURNSTILE_SECRET_KEY:
        return ALLOW_DEV_TURNSTILE
    if not token:
        return False
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
            return bool(result.get("success", False))
    except Exception:
        return False


@router.post("/register", response_model=schemas.UserResponse)
async def register_user(user: schemas.UserCreate, request: Request, db: Session = Depends(database.get_db)):
    client_ip = request.client.host if request.client else "unknown"

    # 0. IP bazlı kayıt spam koruması (Son 10 dakikada en fazla 10 kayıt)
    if not _check_rate_limit(db, "register_ip", client_ip, window_seconds=600, max_requests=10):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla kayıt denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyiniz."
        )

    # 1. Turnstile doğrulaması
    is_turnstile_valid = await verify_turnstile(user.turnstile_token)
    if not is_turnstile_valid:
        raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    # 2. Ad ve Soyad kontrolü
    first_name_clean = (user.first_name or "").strip()
    last_name_clean = (user.last_name or "").strip()
    if not first_name_clean or not last_name_clean:
        raise HTTPException(status_code=400, detail="Ad ve soyad alanları zorunludur.")

    # 3. Şifre güvenlik kriterleri kontrolü
    is_strong, err_msg = validate_password_strength(user.password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    # 4. E-posta normalizasyonu ve mükerrer kayıt kontrolü
    email_clean = user.email.strip().lower()
    db_user = db.query(models.User).filter(models.User.email == email_clean).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")

    hashed_password = auth.get_password_hash(user.password)
    full_name = f"{first_name_clean} {last_name_clean}".strip()
    new_user = models.User(
        email=email_clean,
        hashed_password=hashed_password,
        first_name=first_name_clean,
        last_name=last_name_clean,
        full_name=full_name,
        failed_login_attempts=0
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _record_rate_limit_hit(db, "register_ip", client_ip)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )

    return {
        "id": new_user.id,
        "email": new_user.email,
        "first_name": new_user.first_name,
        "last_name": new_user.last_name,
        "full_name": new_user.full_name,
        "created_at": new_user.created_at,
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    is_turnstile_valid = await verify_turnstile(form_data.client_secret)
    if not is_turnstile_valid:
        raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    email_clean = form_data.username.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    now = datetime.utcnow()

    if user and user.locked_until and user.locked_until > now:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        remaining_minutes = max(1, (remaining_seconds + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Hesabınız kilitlendi. Lütfen {remaining_minutes} dakika sonra tekrar deneyin."
        )

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
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name or f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        "created_at": current_user.created_at,
        "saved_leads_count": saved_count,
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
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "full_name": current_user.full_name,
        "created_at": current_user.created_at,
        "saved_leads_count": saved_count,
    }


def send_reset_email(to_email: str, code: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@esnafradar.com")

    if not (smtp_host and smtp_user and smtp_password):
        # SMTP ayarlanmadığında kod yalnızca sunucu konsoluna yazılır, API yanıtında asla döndürülmez
        print("\n==========================================")
        print("[ESNAFRADAR SIFRE SIFIRLAMA KODU - SUNUCU KONSOLU]")
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
        <div style="font-family: Inter, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #FFF8E7; color: #3F5E45; padding: 32px; border: 2px solid #3F5E45;">
            <h2 style="color: #3F5E45; margin-top: 0;">EsnafRadar Şifre Sıfırlama</h2>
            <p style="color: #3F5E45; font-size: 14px;">Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli doğrulama kodunu kullanarak yeni şifrenizi belirleyebilirsiniz:</p>
            <div style="background: #E8DCC4; border: 2px solid #6F8F72; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3F5E45;">{code}</span>
            </div>
            <p style="color: #6F8F72; font-size: 12px;">Bu kod 15 dakika boyunca geçerlidir. Eğer bu talebi siz yapmadıysanız bu mesajı görmezden gelebilirsiniz.</p>
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


@router.post("/forgot-password")
async def forgot_password(
    req: schemas.ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db)
):
    is_turnstile_valid = await verify_turnstile(req.turnstile_token)
    if not is_turnstile_valid:
        raise HTTPException(status_code=400, detail="Güvenlik doğrulaması (Turnstile) başarısız oldu. Lütfen tekrar deneyin.")

    now = datetime.utcnow()
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(db, "reset_ip", client_ip, window_seconds=600, max_requests=10):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyiniz."
        )

    email_clean = req.email.strip().lower()

    if not _check_rate_limit(db, "reset_email", email_clean, window_seconds=3600, max_requests=5):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Bu e-posta adresi için 1 saat içinde çok fazla sıfırlama talebinde bulunuldu. Lütfen daha sonra tekrar deneyiniz."
        )

    user = db.query(models.User).filter(models.User.email == email_clean).first()

    if user and user.last_reset_request_at:
        elapsed = (now - user.last_reset_request_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Yeni bir kod istemeden önce lütfen {remaining} saniye bekleyiniz."
            )

    # Kriptografik olarak güvenli 6 haneli kod üretimi (secrets modülü)
    code = f"{secrets.randbelow(900000) + 100000}"
    has_smtp = bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))

    if user:
        user.reset_code = code
        user.reset_code_expires = now + timedelta(minutes=15)
        user.last_reset_request_at = now
        user.reset_code_attempts = 0
        db.commit()
        if has_smtp:
            background_tasks.add_task(send_reset_email, user.email, code)
        else:
            send_reset_email(user.email, code)

    _record_rate_limit_hit(db, "reset_ip", client_ip)
    _record_rate_limit_hit(db, "reset_email", email_clean)

    # Güvenlik: Sıfırlama kodu (dev_code) hiçbir koşulda HTTP yanıtında döndürülmez
    return {
        "message": "Şifre sıfırlama kodu kayıtlı e-posta adresinize gönderildi.",
        "cooldown_seconds": 60
    }


@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(database.get_db)):
    is_strong, err_msg = validate_password_strength(req.new_password)
    if not is_strong:
        raise HTTPException(status_code=400, detail=err_msg)

    email_clean = req.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email_clean).first()

    if not user or not user.reset_code:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş doğrulama kodu.")

    now = datetime.utcnow()

    if user.reset_code_expires and user.reset_code_expires < now:
        user.reset_code = None
        user.reset_code_expires = None
        user.reset_code_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="Doğrulama kodunun 15 dakikalık süresi dolmuş. Lütfen yeniden kod isteyiniz.")

    if not secrets.compare_digest(user.reset_code, req.code.strip()):
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

    user.hashed_password = auth.get_password_hash(req.new_password)
    user.reset_code = None
    user.reset_code_expires = None
    user.reset_code_attempts = 0
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    return {"message": "Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz."}
