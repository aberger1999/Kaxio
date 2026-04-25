import json
import logging
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import get_current_user
from server.models.focus import FocusSession
from server.models.notification_preference import NotificationPreference
from server.services.novu_service import trigger_focus_complete

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


class FocusCreate(BaseModel):
    title: Optional[str] = ""
    notes: Optional[str] = ""
    plannedDuration: int
    actualDuration: int
    status: Optional[str] = "completed"
    goalIds: Optional[list] = []
    habitIds: Optional[list] = []
    habitCategories: Optional[list] = []


class FocusUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    goalIds: Optional[list] = None
    habitIds: Optional[list] = None
    habitCategories: Optional[list] = None


@router.get("/focus-sessions")
async def get_sessions(
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    query = (
        select(FocusSession)
        .where(FocusSession.user_id == user.id)
        .order_by(FocusSession.created_at.desc())
    )
    if limit:
        query = query.limit(limit)
    result = await db.execute(query)
    return [s.to_dict() for s in result.scalars().all()]


@router.get("/focus-sessions/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    total_result = await db.execute(
        select(func.count(FocusSession.id)).where(FocusSession.user_id == user.id)
    )
    total = total_result.scalar()

    completed_result = await db.execute(
        select(func.count(FocusSession.id)).where(
            FocusSession.user_id == user.id,
            FocusSession.status == "completed",
        )
    )
    completed = completed_result.scalar()

    minutes_result = await db.execute(
        select(func.coalesce(func.sum(FocusSession.actual_duration), 0)).where(
            FocusSession.user_id == user.id
        )
    )
    total_minutes = minutes_result.scalar() // 60

    return {
        "totalSessions": total,
        "completedSessions": completed,
        "totalMinutes": total_minutes,
    }


@router.post("/focus-sessions")
async def create_session(
    body: FocusCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    session = FocusSession(
        user_id=user.id,
        title=body.title,
        notes=body.notes,
        planned_duration=body.plannedDuration,
        actual_duration=body.actualDuration,
        status=body.status,
        goal_ids=json.dumps(body.goalIds),
        habit_ids=json.dumps(body.habitIds),
        habit_categories=json.dumps(body.habitCategories),
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    # Focus completion notifications are best-effort: session creation should not
    # fail if Novu has a transient issue.
    if session.status == "completed":
        prefs_result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id
            )
        )
        prefs = prefs_result.scalar_one_or_none()
        if prefs is None or prefs.focus_notifications_enabled:
            subscriber_id = (user.email or "").strip().lower()
            if subscriber_id:
                duration_minutes = max(1, round((session.actual_duration or 0) / 60))
                session_title = (session.title or "").strip() or "Focus Session"
                try:
                    await trigger_focus_complete(
                        subscriber_id=subscriber_id,
                        duration_minutes=duration_minutes,
                        session_title=session_title,
                    )
                except Exception:
                    logger.exception(
                        "Failed to send focus completion notification for session %s",
                        session.id,
                    )

    return JSONResponse(content=session.to_dict(), status_code=201)


@router.get("/focus-sessions/{id}")
async def get_session(
    id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.id == id, FocusSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@router.put("/focus-sessions/{id}")
async def update_session(
    id: int,
    body: FocusUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.id == id, FocusSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.title is not None:
        session.title = body.title
    if body.notes is not None:
        session.notes = body.notes
    if body.goalIds is not None:
        session.goal_ids = json.dumps(body.goalIds)
    if body.habitIds is not None:
        session.habit_ids = json.dumps(body.habitIds)
    if body.habitCategories is not None:
        session.habit_categories = json.dumps(body.habitCategories)

    await db.flush()
    await db.refresh(session)
    return session.to_dict()


@router.delete("/focus-sessions/{id}")
async def delete_session(
    id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.id == id, FocusSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.flush()
    return {"message": "Session deleted"}
