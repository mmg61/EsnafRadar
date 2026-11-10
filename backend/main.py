import asyncio
import os
import subprocess
import time
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import database, models
from routers import auth, discovery, leads

# Veritabanı tablolarını başlangıçta otomatik oluştur (yoksa)
models.Base.metadata.create_all(bind=database.engine)


def _ensure_sqlite_columns() -> None:
    """Mevcut SQLite veritabanına yeni eklenen hatırlatıcı sütunlarını veri kaybı olmadan ekler."""
    with database.engine.connect() as conn:
        rows = conn.execute(text("PRAGMA table_info(saved_leads)")).fetchall()
        existing_cols = {row[1] for row in rows}
        if "reminder_at" not in existing_cols:
            conn.execute(text("ALTER TABLE saved_leads ADD COLUMN reminder_at DATETIME"))
        if "reminder_note" not in existing_cols:
            conn.execute(text("ALTER TABLE saved_leads ADD COLUMN reminder_note VARCHAR"))
        if "reminder_completed" not in existing_cols:
            conn.execute(text("ALTER TABLE saved_leads ADD COLUMN reminder_completed BOOLEAN DEFAULT 0"))
        conn.commit()


_ensure_sqlite_columns()

app = FastAPI(title="EsnafRadar API", version="2.1.0")

# CORS yapılandırması
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Açık tarayıcı sekmelerini takip eden durum değişkenleri
_active_ws_clients: Set[WebSocket] = set()
_last_client_ping_ts: float = 0.0


def _shutdown_all_servers() -> None:
    """Tarayıcı sekmesi kapatıldığında hem Frontend (5173) hem Backend (8000) sunucularını sonlandırır."""
    if os.name == "nt":
        cmd = (
            'for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"\') '
            'do taskkill /F /T /PID %a >nul 2>&1 & '
            'for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"\') '
            'do taskkill /F /T /PID %a >nul 2>&1'
        )
        subprocess.Popen(cmd, shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
    os._exit(0)


async def _check_and_shutdown_after_grace(grace_seconds: float = 4.0) -> None:
    await asyncio.sleep(grace_seconds)
    # Sayfa yenilemesi (F5) yapıldıysa veya başka bir sekme açıksa kapatma
    if len(_active_ws_clients) > 0:
        return
    if (time.time() - _last_client_ping_ts) < (grace_seconds - 0.5):
        return
    _shutdown_all_servers()


@app.get("/")
def read_root():
    return {"message": "EsnafRadar API aktif", "status": "ok"}


@app.post("/api/heartbeat")
def client_heartbeat():
    global _last_client_ping_ts
    _last_client_ping_ts = time.time()
    return {"status": "alive"}


@app.post("/api/tab-closed")
async def client_tab_closed():
    if len(_active_ws_clients) == 0:
        asyncio.create_task(_check_and_shutdown_after_grace(4.0))
    return {"status": "closing_check_scheduled"}


@app.websocket("/api/keepalive")
async def websocket_keepalive(websocket: WebSocket):
    global _last_client_ping_ts
    await websocket.accept()
    _active_ws_clients.add(websocket)
    _last_client_ping_ts = time.time()
    try:
        while True:
            await websocket.receive_text()
            _last_client_ping_ts = time.time()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _active_ws_clients.discard(websocket)
        if len(_active_ws_clients) == 0:
            asyncio.create_task(_check_and_shutdown_after_grace(4.0))


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["Discovery"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
