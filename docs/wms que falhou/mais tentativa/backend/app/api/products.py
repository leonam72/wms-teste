from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.inventory import Product
from .deps import get_current_user, get_db

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).order_by(Product.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/")
async def create_product(
    payload: dict, # { "code": "...", "name": "...", "sku": "..." }
    db: AsyncSession = Depends(get_db)
):
    # Verifica duplicidade
    stmt = select(Product).where(Product.code == payload['code'])
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Código de produto já cadastrado")

    new_product = Product(
        code=payload['code'],
        name=payload['name'],
        sku=payload.get('sku'),
        category=payload.get('category'),
        is_perishable=payload.get('is_perishable', False)
    )
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    return new_product

@router.get("/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return product
