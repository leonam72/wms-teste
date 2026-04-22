from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

from backend.app.api import deps
from backend.app.core.database import get_db
from backend.app.models.auth import User
from backend.app.models.inventory import Task
from backend.app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCompletePayload(BaseModel):
    actual_to_drawer_id: Optional[str] = None
    notes: Optional[str] = None

@router.get("/pending")
async def get_pending_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Lista tarefas pendentes ou já atribuídas ao usuário logado."""
    stmt = select(Task).where(
        or_(
            Task.status == "pending",
            (Task.status == "assigned") & (Task.assigned_user_id == current_user.id)
        )
    ).order_by(Task.priority.desc(), Task.created_at.asc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{task_id}/assign")
async def assign_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """O operador assume a tarefa para execução."""
    task = await task_service.assign_task(db, task_id, current_user.id)
    await db.commit()
    return {"status": "assigned", "task_id": task.id, "assigned_to": current_user.username}

@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    payload: TaskCompletePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Finaliza a tarefa, efetivando a movimentação física no WMS."""
    task = await task_service.complete_task(
        db, 
        task_id, 
        current_user.id, 
        actual_to_drawer_id=payload.actual_to_drawer_id
    )
    
    await db.commit()
    return {"status": "completed", "task_id": task.id, "completed_at": task.completed_at}
