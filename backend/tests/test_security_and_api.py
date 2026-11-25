import atexit
import inspect
import os
import sys
import tempfile
import pytest
from pydantic import ValidationError

# Testlerin gerçek esnafradar.db veritabanına dokunmaması için izole geçici SQLite dosyası ayarla
_TEMP_DB_FD, _TEMP_DB_PATH = tempfile.mkstemp(prefix="esnafradar_test_", suffix=".db")
os.close(_TEMP_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEMP_DB_PATH}"
os.environ["ALLOW_DEV_TURNSTILE"] = "true"


def _cleanup_temp_db() -> None:
    try:
        import database as _db
        _db.engine.dispose()
    except Exception:
        pass
    try:
        if os.path.exists(_TEMP_DB_PATH):
            os.remove(_TEMP_DB_PATH)
    except Exception:
        pass


atexit.register(_cleanup_temp_db)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
import auth
import main
import models
import database
import schemas
from crypto_utils import ENC_PREFIX, decrypt_secret
from routers import auth as auth_router
from routers.leads import _sanitize_csv_cell
import services.auditor as auditor_mod
from services.auditor import _is_safe_public_url

client = TestClient(main.app)


def test_tests_use_isolated_temp_database():
    assert "esnafradar_test_" in database.SQLALCHEMY_DATABASE_URL
    assert not database.SQLALCHEMY_DATABASE_URL.endswith("/esnafradar.db")


def test_jwt_secret_key_is_strong_and_not_default():
    assert auth.SECRET_KEY != "super_secret_esnafradar_key_for_dev_only"
    assert len(auth.SECRET_KEY) >= 32


def test_ssrf_and_dns_rebinding_protection_and_no_verify_false():
    assert _is_safe_public_url("http://localhost:8000/api") is False
    assert _is_safe_public_url("http://127.0.0.1:8000") is False
    assert _is_safe_public_url("http://169.254.169.254/latest/meta-data/") is False
    assert _is_safe_public_url("http://192.168.1.1/admin") is False
    assert _is_safe_public_url("http://10.0.0.1/") is False
    assert _is_safe_public_url("http://172.16.0.5/") is False
    assert _is_safe_public_url("ftp://example.com/file") is False

    # auditor.py içerisinde hiçbir yerde verify=False veya follow_redirects=True bulunmamalıdır
    auditor_src = inspect.getsource(auditor_mod)
    assert "verify=False" not in auditor_src
    assert "follow_redirects=True" not in auditor_src


@pytest.mark.anyio
async def test_turnstile_fails_closed_when_dev_mode_disabled(monkeypatch):
    monkeypatch.setattr(auth_router, "CLOUDFLARE_TURNSTILE_SECRET_KEY", "")
    monkeypatch.setattr(auth_router, "ALLOW_DEV_TURNSTILE", False)
    assert await auth_router.verify_turnstile(None) is False
    assert await auth_router.verify_turnstile("dummy_token") is False


def test_csv_formula_injection_sanitization():
    assert _sanitize_csv_cell("=CMD|' /C calc'!A0").startswith("'")
    assert _sanitize_csv_cell("+SUM(A1:A10)").startswith("'")
    assert _sanitize_csv_cell("-2+3+cmd").startswith("'")
    assert _sanitize_csv_cell("@SUM(1+1)").startswith("'")
    assert _sanitize_csv_cell("Normal Esnaf Lokantasi") == "Normal Esnaf Lokantasi"


def test_pydantic_schema_validation_for_status_and_channel():
    valid_status = schemas.LeadStatusUpdate(status="contacted")
    assert valid_status.status == "contacted"

    with pytest.raises(ValidationError):
        schemas.LeadStatusUpdate(status="hacked_arbitrary_status")

    valid_channel = schemas.OutreachLogCreate(channel="WhatsApp", message_content="Merhaba")
    assert valid_channel.channel == "WhatsApp"

    with pytest.raises(ValidationError):
        schemas.OutreachLogCreate(channel="SMS_Injection", message_content="Merhaba")

    with pytest.raises(ValidationError):
        schemas.LeadNoteCreate(content="x" * 2500)


def test_forgot_password_never_leaks_dev_code():
    db = database.SessionLocal()
    try:
        db.query(models.RateLimitLog).delete()
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/auth/forgot-password",
        json={"email": "security_test_user@example.com", "turnstile_token": "dev"}
    )
    assert res.status_code == 200
    body = res.json()
    assert "dev_code" not in body
    assert "code" not in body
    assert body.get("cooldown_seconds") == 60


def test_encrypted_per_user_gemini_key_and_account_deletion():
    db = database.SessionLocal()
    try:
        db.query(models.RateLimitLog).delete()
        db.commit()
    finally:
        db.close()

    r_a = client.post(
        "/api/auth/register",
        json={
            "email": "user_a_test@example.com",
            "password": "Password123",
            "first_name": "Ali",
            "last_name": "Yilmaz",
            "turnstile_token": "dev"
        }
    )
    assert r_a.status_code == 200
    token_a = r_a.json()["access_token"]

    r_b = client.post(
        "/api/auth/register",
        json={
            "email": "user_b_test@example.com",
            "password": "Password123",
            "first_name": "Burak",
            "last_name": "Kaya",
            "turnstile_token": "dev"
        }
    )
    assert r_b.status_code == 200
    token_b = r_b.json()["access_token"]

    plain_api_key = "AIzaSyTestUserAPrivateKey123456789"
    cfg_res = client.post(
        "/api/discovery/ai-config",
        json={"api_key": plain_api_key},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert cfg_res.status_code == 200
    assert cfg_res.json()["configured"] is True

    # Veritabanında düz metin olarak değil, Fernet ile şifrelenmiş olarak durmalıdır
    db = database.SessionLocal()
    try:
        user_a_row = db.query(models.User).filter(models.User.email == "user_a_test@example.com").first()
        assert user_a_row is not None
        assert user_a_row.gemini_api_key is not None
        assert user_a_row.gemini_api_key != plain_api_key
        assert user_a_row.gemini_api_key.startswith(ENC_PREFIX)
        assert decrypt_secret(user_a_row.gemini_api_key) == plain_api_key
    finally:
        db.close()

    # User B'nin anahtarı etkilenmemelidir
    status_b = client.get(
        "/api/discovery/ai-status",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert status_b.status_code == 200
    assert status_b.json()["masked_key"] != cfg_res.json()["masked_key"]

    # Sayfalama (skip & limit) testi
    leads_res = client.get(
        "/api/leads?skip=0&limit=10",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert leads_res.status_code == 200
    assert isinstance(leads_res.json(), list)

    # Hatalı şifreyle hesap silme reddedilmelidir
    del_bad = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "WrongPassword123"},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert del_bad.status_code == 400

    # Doğru şifreyle hesap kalıcı olarak silinmelidir
    del_ok = client.request(
        "DELETE",
        "/api/auth/me",
        json={"password": "Password123"},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert del_ok.status_code == 200

    # Silinen hesapla profil erişimi 401 dönmelidir
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert me_after.status_code == 401


def test_register_and_update_company_name():
    db = database.SessionLocal()
    try:
        db.query(models.RateLimitLog).delete()
        db.commit()
    finally:
        db.close()

    reg = client.post(
        "/api/auth/register",
        json={
            "email": "agency_owner@example.com",
            "password": "Password123",
            "first_name": "Mehmet",
            "last_name": "Kaya",
            "company_name": "Kaya Dijital Ekibi",
            "turnstile_token": "dev",
        },
    )
    assert reg.status_code == 200
    body = reg.json()
    assert body["company_name"] == "Kaya Dijital Ekibi"
    token = body["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["company_name"] == "Kaya Dijital Ekibi"

    upd = client.put(
        "/api/auth/me",
        json={"first_name": "Mehmet", "last_name": "Kaya", "company_name": "Kaya Web Atolyesi"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upd.status_code == 200
    assert upd.json()["company_name"] == "Kaya Web Atolyesi"
