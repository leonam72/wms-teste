from backend.app.api.deps import *
from backend.app.api.routes_auth import router as auth_router
from backend.app.api.routes_receiving import router as receiving_router
from backend.app.api.routes_separation import router as separation_router
from backend.app.api.routes_sync import router as sync_router
from backend.app.api.routes_inventory import router as inventory_router
from backend.app.api.routes_wms import router as wms_router

__all__ = [
    "auth_router",
    "receiving_router",
    "separation_router",
    "sync_router",
    "inventory_router",
    "wms_router",
]

# Note: This __all__ list is automatically updated by the `scripts/update_all.py` script.
