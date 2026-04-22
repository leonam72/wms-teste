from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import date, timedelta

from ..services.inventory_service import InventoryService
from ..models.inventory import Depot, Shelf, Drawer, Product, StockItem, Expiry
from ..schemas.inventory import DepotCreate, ShelfCreate, AllocateProduct, MoveStock
from .deps import get_db, get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

# --- DEPÓSITOS (CDs) ---

@router.get("/depots")
async def list_depots(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Depot))
    return result.scalars().all()

@router.post("/depots")
async def create_depot(
    payload: DepotCreate,
    db: AsyncSession = Depends(get_db)
):
    new_depot = Depot(name=payload.name, address=payload.address)
    db.add(new_depot)
    await db.commit()
    await db.refresh(new_depot)
    return new_depot

# --- PRATELEIRAS E GAVETAS ---

@router.get("/depots/{depot_id}/shelves")
async def list_shelves(
    depot_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Shelf).where(Shelf.depot_id == depot_id).options(selectinload(Shelf.drawers))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/shelves")
async def create_shelf(
    payload: ShelfCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        new_shelf = Shelf(
            depot_id=payload.depot_id,
            code=payload.code,
            floors=payload.floors,
            drawers_per_floor=payload.drawers_per_floor
        )
        db.add(new_shelf)
        await db.flush()
        
        # Gerar gavetas automaticamente
        for f in range(1, new_shelf.floors + 1):
            for d in range(1, new_shelf.drawers_per_floor + 1):
                d_key = f"{payload.code}{f}-G{d:02d}"
                db.add(Drawer(shelf_id=new_shelf.id, floor_number=f, drawer_number=d, drawer_key=d_key))
        
        await db.commit()
        await db.refresh(new_shelf)
        return new_shelf
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

# --- PRODUTOS ---

@router.get("/")
async def list_inventory(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StockItem)
        .options(selectinload(StockItem.product), selectinload(StockItem.drawer))
        .limit(100)
    )
    return result.scalars().all()

@router.post("/allocate")
async def allocate_product(
    payload: AllocateProduct,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        new_item = await InventoryService.allocate_product(
            db=db,
            product_id=payload.product_id,
            drawer_id=payload.drawer_id,
            quantity=payload.quantity,
            operator=current_user,
            lot=payload.lot,
            expiry_date=payload.expiry_date
        )
        return {"status": "success", "id": new_item.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/move")
async def move_stock(
    payload: MoveStock,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        result = await InventoryService.move_stock(
            db=db,
            item_id=payload.item_id,
            to_drawer_id=payload.to_drawer_id,
            quantity=payload.quantity,
            operator=current_user
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
