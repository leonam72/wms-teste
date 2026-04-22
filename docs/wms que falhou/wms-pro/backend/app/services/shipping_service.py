from typing import List, Optional, Any
from datetime import datetime
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from backend.app.models.inventory import LicensePlate, StockItem, Drawer, InventoryMovement
from backend.app.models.sync import SyncState

async def create_shipping_package(
    db: AsyncSession,
    stock_item_ids: List[str],
    lpn_type: str = "box"
) -> LicensePlate:
    """
    Agrupa itens de estoque em um volume de expedição (Packing).
    Cria uma nova LPN e move os itens para dentro dela.
    """
    # 1. Cria a nova LPN (Volume de Saída)
    lpn_code = f"SHIP-{uuid.uuid4().hex[:8].upper()}"
    new_lpn = LicensePlate(
        code=lpn_code,
        lpn_type=lpn_type,
        status="closed", # Volume fechado pronto para expedição
        drawer_id=None   # Estará em área de packing/staging
    )
    db.add(new_lpn)
    await db.flush()

    # 2. Vincula os StockItems a esta LPN
    for item_id in stock_item_ids:
        result = await db.execute(select(StockItem).where(StockItem.id == item_id))
        item = result.scalars().first()
        if item:
            item.license_plate_id = new_lpn.id
            item.status = "reserved" # Reservado para expedição

    return new_lpn

async def ship_volume(
    db: AsyncSession,
    lpn_code: str,
    user_id: str,
    username: str
) -> bool:
    """
    Efetiva a saída (Expedição) de um volume do armazém.
    Marca como 'shipped' e remove do saldo físico das gavetas.
    """
    result = await db.execute(select(LicensePlate).where(LicensePlate.code == lpn_code))
    lpn = result.scalars().first()
    
    if not lpn:
        raise HTTPException(status_code=404, detail="Volume (LPN) não encontrado.")
    
    if lpn.status == "shipping":
        return True # Já expedido

    # 1. Atualizar status dos itens para 'shipped' e remover da gaveta
    # No WMS real, aqui também removeríamos do snapshot JSON (SyncState)
    items_stmt = select(StockItem).where(StockItem.license_plate_id == lpn.id)
    items_res = await db.execute(items_stmt)
    items = items_res.scalars().all()
    
    for item in items:
        # Registrar movimento de saída
        movement = InventoryMovement(
            action="shipping_out",
            detail=f"Expedição LPN {lpn.code} - Item {item.product_id}",
            user_id=user_id,
            username=username,
            product_code=None, # Idealmente buscar o código do produto
            payload_json=None
        )
        db.add(movement)
        
        item.status = "shipped"
        item.drawer_id = None # Saiu do armazém
    
    lpn.status = "shipping"
    lpn.drawer_id = None
    
    return True

async def get_staging_area_suggestion(db: AsyncSession, depot_id: str) -> Optional[str]:
    """Sugere uma área de Staging (docas) para posicionar volumes prontos."""
    # Lógica simplificada: busca gavetas em prateleiras marcadas como 'staging' ou perto da doca
    # Por agora, retorna a primeira gaveta do depósito
    return f"STAGING.{depot_id}.01"
