import asyncio
import os
import subprocess
import time
from typing import Set
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import database, models, migrations
from routers import auth, discovery, leads

models.Base.metadata.create_all(bind=database.engine)
migrations.run_migrations(database.engine)

app = FastAPI(title="EsnafRadar API", version="2.2.0")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Yalnızca yerel masaüstü başlatıcıda (baslat.bat -> ENABLE_LOCAL_AUTO_SHUTDOWN=1) aktif olur;
# çok kullanıcılı SaaS ortamında varsayılan olarak kapalıdır.
ENABLE_LOCAL_AUTO_SHUTDOWN = os.getenv("ENABLE_LOCAL_AUTO_SHUTDOWN", "0").strip() in ("1", "true", "yes")
_active_ws_clients: Set[WebSocket] = set()
_last_client_ping_ts: float = 0.0


def _is_loopback_host(host: str | None) -> bool:
    return host in ("127.0.0.1", "::1", "localhost")


def _shutdown_all_servers() -> None:
    if not ENABLE_LOCAL_AUTO_SHUTDOWN:
        return
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
    if not ENABLE_LOCAL_AUTO_SHUTDOWN:
        return
    await asyncio.sleep(grace_seconds)
    if len(_active_ws_clients) > 0:
        return
    if (time.time() - _last_client_ping_ts) < (grace_seconds - 0.5):
        return
    _shutdown_all_servers()


@app.get("/")
def read_root():
    return {"message": "EsnafRadar API aktif", "status": "ok"}


@app.post("/api/heartbeat")
def client_heartbeat(request: Request):
    global _last_client_ping_ts
    if _is_loopback_host(request.client.host if request.client else None):
        _last_client_ping_ts = time.time()
    return {"status": "alive"}


@app.post("/api/tab-closed")
async def client_tab_closed(request: Request):
    client_host = request.client.host if request.client else None
    if ENABLE_LOCAL_AUTO_SHUTDOWN and _is_loopback_host(client_host) and len(_active_ws_clients) == 0:
        asyncio.create_task(_check_and_shutdown_after_grace(4.0))
    return {"status": "ok"}


@app.websocket("/api/keepalive")
async def websocket_keepalive(websocket: WebSocket):
    global _last_client_ping_ts
    client_host = websocket.client.host if websocket.client else None
    await websocket.accept()
    if ENABLE_LOCAL_AUTO_SHUTDOWN and _is_loopback_host(client_host):
        _active_ws_clients.add(websocket)
        _last_client_ping_ts = time.time()
    try:
        while True:
            await websocket.receive_text()
            if ENABLE_LOCAL_AUTO_SHUTDOWN and _is_loopback_host(client_host):
                _last_client_ping_ts = time.time()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if websocket in _active_ws_clients:
            _active_ws_clients.discard(websocket)
            if ENABLE_LOCAL_AUTO_SHUTDOWN and len(_active_ws_clients) == 0:
                asyncio.create_task(_check_and_shutdown_after_grace(4.0))


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["Discovery"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
