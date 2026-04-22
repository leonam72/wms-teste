from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..services.floorplan_service import FloorplanService
from .deps import get_current_user, get_db

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/{depot_id}/layout")
async def get_depot_layout(
    depot_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        layout = await FloorplanService.get_depot_layout(db, depot_id)
        return layout
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{depot_id}/shelves/{shelf_id}/position")
async def update_shelf_position(
    depot_id: str,
    shelf_id: str,
    payload: dict, # { "x": 0, "y": 0, "rotation": 0 }
    db: AsyncSession = Depends(get_db)
):
    try:
        fp = await FloorplanService.update_shelf_position(
            db, depot_id, shelf_id, 
            payload['x'], payload['y'], payload.get('rotation', 0)
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
