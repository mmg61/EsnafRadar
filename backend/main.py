from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import database, models
from routers import auth, discovery, leads

# Veritabanı tablolarını başlangıçta otomatik oluştur (yoksa)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="EsnafRadar API", version="2.0.0")

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
