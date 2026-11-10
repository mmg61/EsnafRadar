from fastapi import FastAPI
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

@app.get("/")
def read_root():
    return {"message": "EsnafRadar API aktif", "status": "ok"}

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["Discovery"])
app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
