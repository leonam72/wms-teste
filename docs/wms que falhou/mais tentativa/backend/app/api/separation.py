from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..services.separation_service import SeparationService
from ..models.separation import RomaneioSeparacao
from .deps import get_current_user, get_db

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/romaneios")
async def list_romaneios(
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RomaneioSeparacao).order_by(RomaneioSeparacao.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/romaneios/{romaneio_id}/picking-list")
async def get_picking_list(
    romaneio_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        suggestions = await SeparationService.get_picking_suggestions(db, romaneio_id)
        return suggestions
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/romaneios")
async def create_romaneio(
    payload: dict, # { "codigo": "...", "itens": [{ "product_id": "...", "quantity": 1 }] }
    db: AsyncSession = Depends(get_db)
):
    try:
        romaneio = await SeparationService.create_romaneio(db, payload['codigo'], payload['itens'])
        return romaneio
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
