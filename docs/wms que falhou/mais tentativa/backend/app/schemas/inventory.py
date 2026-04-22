from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

class DepotCreate(BaseModel):
    name: str
    address: Optional[str] = None

class ShelfCreate(BaseModel):
    depot_id: str
    code: str
    floors: int = Field(gt=0)
    drawers_per_floor: int = Field(gt=0)

class AllocateProduct(BaseModel):
    product_id: str
    drawer_id: str
    quantity: int = Field(gt=0)
    lot: Optional[str] = None
    expiry_date: Optional[date] = None

class MoveStock(BaseModel):
    item_id: str
    to_drawer_id: str
    quantity: int = Field(gt=0)
