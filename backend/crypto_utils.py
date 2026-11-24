import base64
import hashlib
from datetime import datetime, timezone
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

ENC_PREFIX = "enc:v1:"


def utcnow() -> datetime:
    """Python 3.12+ uyumlu, uyarısız (naive UTC) zaman damgası üretir."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_fernet() -> Fernet:
    import auth
    digest = hashlib.sha256(auth.SECRET_KEY.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def encrypt_secret(plaintext: Optional[str]) -> Optional[str]:
    """Hassas API anahtarlarını veritabanına yazmadan önce Fernet (AES-128-CBC + HMAC) ile şifreler."""
    if not plaintext:
        return None
    clean = plaintext.strip()
    if not clean:
        return None
    if clean.startswith(ENC_PREFIX):
        return clean
    token = _get_fernet().encrypt(clean.encode("utf-8")).decode("utf-8")
    return f"{ENC_PREFIX}{token}"


def decrypt_secret(stored: Optional[str]) -> Optional[str]:
    """Veritabanındaki şifreli API anahtarını çözer; eski düz metin kayıtlarla geriye dönük uyumludur."""
    if not stored:
        return None
    clean = stored.strip()
    if not clean:
        return None
    if not clean.startswith(ENC_PREFIX):
        return clean
    cipher_part = clean[len(ENC_PREFIX):]
    try:
        return _get_fernet().decrypt(cipher_part.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None
