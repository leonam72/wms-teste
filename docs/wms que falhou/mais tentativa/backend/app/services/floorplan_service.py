from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.inventory import Shelf, Drawer
from ..models.floorplan import FloorPlanShelf, FloorPlanObject

class FloorplanService:
    @staticmethod
    async def get_depot_layout(db: AsyncSession, depot_id: str):
        """Retorna o layout completo de um depósito: prateleiras posicionadas e objetos."""
        
        # 1. Busca prateleiras e suas posições
        stmt_shelves = select(Shelf, FloorPlanShelf).join(
            FloorPlanShelf, Shelf.id == FloorPlanShelf.shelf_id, isouter=True
        ).where(Shelf.depot_id == depot_id)
        
        shelves_result = await db.execute(stmt_shelves)
        layout_shelves = []
        
        for shelf, fp in shelves_result.all():
            layout_shelves.append({
                "id": shelf.id,
                "code": shelf.code,
                "x": fp.x if fp else 0,
                "y": fp.y if fp else 0,
                "rotation": fp.rotation if fp else 0,
                "floors": shelf.floors,
                "drawers_per_floor": shelf.drawers_per_floor
            })
            
        # 2. Busca objetos decorativos (ruas, textos, etc)
        stmt_objects = select(FloorPlanObject).where(FloorPlanObject.depot_id == depot_id)
        objects_result = await db.execute(stmt_objects)
        layout_objects = [obj for obj in objects_result.scalars().all()]
        
        return {
            "shelves": layout_shelves,
            "objects": layout_objects
        }

    @staticmethod
    async def update_shelf_position(db: AsyncSession, depot_id: str, shelf_id: str, x: float, y: float, rotation: float = 0):
        stmt = select(FloorPlanShelf).where(
            FloorPlanShelf.depot_id == depot_id, 
            FloorPlanShelf.shelf_id == shelf_id
        )
        fp = (await db.execute(stmt)).scalar_one_or_none()
        
        if not fp:
            fp = FloorPlanShelf(depot_id=depot_id, shelf_id=shelf_id, x=x, y=y, rotation=rotation)
            db.add(fp)
        else:
            fp.x = x
            fp.y = y
            fp.rotation = rotation
            
        await db.commit()
        return fp
