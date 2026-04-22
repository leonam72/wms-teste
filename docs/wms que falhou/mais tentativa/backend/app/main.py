import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
import logging

from .api import auth, inventory, receiving, floorplan, products, audit, separation
from .core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Configuração de Logs detalhados
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erro Global: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor", "error": str(exc)},
    )

# Base directory for relative paths (main.py está em backend/app/)
# .parent -> app/
# .parent.parent -> backend/
# .parent.parent.parent -> raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# --- SEGURANÇA: Middleware de Headers ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Configuração de CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Montagem de Arquivos Estáticos e Templates
static_dir = FRONTEND_DIR / "static"
templates_dir = FRONTEND_DIR / "templates"

if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

if templates_dir.exists():
    templates = Jinja2Templates(directory=str(templates_dir))

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.get("/login", response_class=HTMLResponse)
async def read_login(request: Request):
    return templates.TemplateResponse(request, "login.html")

# Rotas de API
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(receiving.router, prefix="/api/receiving", tags=["Receiving"])
app.include_router(floorplan.router, prefix="/api/floorplan", tags=["Floorplan"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(separation.router, prefix="/api/separation", tags=["Separation"])

@app.get("/api/health")
async def health_check():
    return {"status": "operational", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
