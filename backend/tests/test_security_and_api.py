import os
import sys
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import auth
import main
import models
import database
import schemas
from routers.leads import _sanitize_csv_cell
from services.auditor import _is_safe_public_url

client = TestClient(main.app)


def test_jwt_secret_key_is_strong_and_not_default():
    assert auth.SECRET_KEY != "super_secret_esnafradar_key_for_dev_only"
    assert len(auth.SECRET_KEY) >= 32


def test_ssrf_protection_blocks_private_and_loopback_urls():
    assert _is_safe_public_url("http://localhost:8000/api") is False
    assert _is_safe_public_url("http://127.0.0.1:8000") is False
    assert _is_safe_public_url("http://169.254.169.254/latest/meta-data/") is False
    assert _is_safe_public_url("http://192.168.1.1/admin") is False
    assert _is_safe_public_url("http://10.0.0.1/") is False
    assert _is_safe_public_url("http://172.16.0.5/") is False
    assert _is_safe_public_url("ftp://example.com/file") is False


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


def test_per_user_gemini_key_isolation_and_leads_pagination():
    db = database.SessionLocal()
    try:
        db.query(models.RateLimitLog).delete()
        db.query(models.User).filter(
            models.User.email.in_(["user_a_test@example.com", "user_b_test@example.com"])
        ).delete(synchronize_session=False)
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

    # User A kendi Gemini anahtarını kaydeder
    cfg_res = client.post(
        "/api/discovery/ai-config",
        json={"api_key": "AIzaSyTestUserAPrivateKey123456789"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert cfg_res.status_code == 200
    assert cfg_res.json()["configured"] is True

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
