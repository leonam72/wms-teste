from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..services.nfe_service import NFeService
from ..services.receiving_service import ReceivingService
from ..models.receiving import ReceivingSession, ReceivingItem
from .deps import get_current_user, get_db

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/upload")
async def upload_nfe(
    file: UploadFile = File(...)
):
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="O arquivo deve ser um XML de NF-e.")
    
    try:
        content = await file.read()
        parsed_data = NFeService.parse_xml(content)
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar NF-e: {str(e)}")

@router.post("/sessions")
async def start_conference_session(
    nfe_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        session = await ReceivingService.create_session_from_nfe(db, nfe_data, current_user)
        return {"status": "success", "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao iniciar sessão: {str(e)}")

@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db)
):
    sessions = await ReceivingService.list_pending_sessions(db)
    return sessions

@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ReceivingSession)
        .where(ReceivingSession.id == session_id)
        .options(selectinload(ReceivingSession.items))
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session

@router.get("/sessions/{session_id}/divergence")
async def get_session_divergence(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        report = await ReceivingService.get_session_divergence(db, session_id)
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/sessions/{session_id}/count")
async def register_count(
    session_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    ean = payload.get("ean")
    qty = payload.get("qty", 1.0)
    
    stmt = select(ReceivingItem).where(
        (ReceivingItem.session_id == session_id) & 
        ((ReceivingItem.ean == ean) | (ReceivingItem.product_code == ean))
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Produto não encontrado nesta Nota Fiscal")
    
    item.counted_qty += qty
    await db.commit()
    await db.refresh(item)
    return item
