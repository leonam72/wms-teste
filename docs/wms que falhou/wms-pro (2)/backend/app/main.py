from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from backend.app.core.config import settings
from backend.app.core.database import engine, Base
from backend.app.api import routes_auth, routes_receiving, routes_wms
from backend.app.core.rate_limit import _ensure_table as _ensure_rate_limit_table
from backend.app.core.nfe_watcher import start_watcher, stop_watcher
import asyncio
import logging
import os
import secrets
import sys
import webbrowser
from pathlib import Path
from threading import Timer

logger = logging.getLogger(__name__)

# --- APP SETUP ---
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "API do WMS Pro para autenticação, sincronização do estado operacional, "
        "estrutura de depósitos, qualidade, conferência cega e auditoria."
    ),
    version="2026.03",
    contact={"name": "WMS Pro", "url": "https://github.com/leonam72/WMS-PRO"},
)

@app.on_event("startup")
async def on_startup() -> None:
    """Inicializa tabelas auxiliares, watcher de XMLs e verifica integridade do banco."""
    await _ensure_rate_limit_table()
    if not Path(settings.NFE_XML_DIR).expanduser().exists():
        logger.warning("Diretório NFE_XML_DIR não encontrado no startup: %s", settings.NFE_XML_DIR)
    loop = asyncio.get_event_loop()
    start_watcher(loop)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Para o watcher de XMLs ao encerrar."""
    stop_watcher()

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # FIX C-06 / M-06: nonce por request elimina unsafe-inline do script-src
        # O nonce é injetado no state do request para uso nos templates
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "worker-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# --- ROUTES ---
app.include_router(routes_auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(routes_wms.router, prefix=f"{settings.API_V1_STR}/wms", tags=["wms"])
app.include_router(routes_receiving.router, prefix=f"{settings.API_V1_STR}/wms", tags=["receiving"])

def get_resource_path(relative_path: str) -> str:
    if getattr(sys, "frozen", False):
        base_path = getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent)
    else:
        base_path = Path(__file__).resolve().parents[2]
    return str((Path(base_path) / relative_path).resolve())


# --- STATIC & TEMPLATES ---
FRONTEND_DIR = get_resource_path("frontend")

app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(FRONTEND_DIR, "templates"))

# --- ROOT ---
@app.get("/", summary="Frontend principal", description="Entrega a interface principal do WMS.")
async def read_root(request: Request):
    nonce = getattr(request.state, "csp_nonce", "")
    return templates.TemplateResponse("index.html", {"request": request, "csp_nonce": nonce})

@app.get("/login", summary="Tela de login", description="Entrega a interface de autenticação do WMS.")
async def read_login(request: Request):
    nonce = getattr(request.state, "csp_nonce", "")
    return templates.TemplateResponse("login.html", {"request": request, "csp_nonce": nonce})

@app.get("/separador", summary="Módulo separador", description="Entrega a interface isolada do módulo separador.")
async def read_separator(request: Request):
    nonce = getattr(request.state, "csp_nonce", "")
    return templates.TemplateResponse("separator.html", {"request": request, "csp_nonce": nonce})

@app.get("/separador/login", summary="Login do módulo separador", description="Entrega a interface de login isolada para separadores.")
async def read_separator_login(request: Request):
    nonce = getattr(request.state, "csp_nonce", "")
    return templates.TemplateResponse("separator_login.html", {"request": request, "csp_nonce": nonce})

@app.get("/service-worker.js", include_in_schema=False)
async def service_worker():
    path = os.path.join(FRONTEND_DIR, "static", "service-worker.js")
    response = FileResponse(path, media_type="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    return response

@app.api_route("/favicon.ico", methods=["GET", "HEAD"], include_in_schema=False)
async def favicon():
    path = os.path.join(FRONTEND_DIR, "static", "favicon.ico")
    return FileResponse(path, media_type="image/x-icon")

# --- API PLACEHOLDER ---
@app.get("/api/health", summary="Saúde da aplicação", description="Verifica se o backend está ativo e apto a responder.")
async def health_check():
    return {"status": "ok", "mode": "local"}

if __name__ == "__main__":
    import uvicorn

    def open_browser() -> None:
        webbrowser.open("http://127.0.0.1:8000")

    Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
