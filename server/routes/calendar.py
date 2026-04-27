from datetime import datetime
import json
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import get_current_user
from server.models.calendar_event import CalendarEvent
from server.services.recurrence import expand_recurring_events

router = APIRouter(prefix="")


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start: str
    end: str
    allDay: Optional[bool] = False
    color: Optional[str] = "#3b82f6"
    category: Optional[str] = ""
    recurrence: Optional[str] = ""
    goalId: Optional[int] = None
    reminderMinutes: Optional[int] = None
    reminderMinutesList: Optional[list[int]] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    allDay: Optional[bool] = None
    color: Optional[str] = None
    category: Optional[str] = None
    recurrence: Optional[str] = None
    goalId: Optional[int] = None
    reminderMinutes: Optional[int] = None
    reminderMinutesList: Optional[list[int]] = None


def _normalize_reminders(
    reminder_minutes: int | None,
    reminder_minutes_list: list[int] | None,
) -> list[int]:
    """Return sorted, unique reminder offsets in minutes."""
    raw_reminders = reminder_minutes_list
    if raw_reminders is None:
        raw_reminders = [reminder_minutes] if reminder_minutes is not None else []

    reminders = []
    for reminder in raw_reminders:
        if reminder is None:
            continue
        try:
            value = int(reminder)
        except (TypeError, ValueError):
            continue
        if value > 0:
            reminders.append(value)
    return sorted(set(reminders))


@router.get("/calendar")
async def get_events(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    range_start = datetime.fromisoformat(start) if start else None
    range_end = datetime.fromisoformat(end) if end else None

    # Non-recurring events: normal range filter
    nr_conditions = [
        CalendarEvent.user_id == user.id,
        or_(CalendarEvent.recurrence == "", CalendarEvent.recurrence.is_(None)),
    ]
    if range_start:
        nr_conditions.append(CalendarEvent.end >= range_start)
    if range_end:
        nr_conditions.append(CalendarEvent.start <= range_end)

    nr_query = (
        select(CalendarEvent)
        .where(and_(*nr_conditions))
        .order_by(CalendarEvent.start)
    )
    nr_result = await db.execute(nr_query)
    non_recurring = [e.to_dict() for e in nr_result.scalars().all()]

    # Recurring events: started before range ends (they generate forward)
    r_conditions = [
        CalendarEvent.user_id == user.id,
        CalendarEvent.recurrence != "",
        CalendarEvent.recurrence.isnot(None),
    ]
    if range_end:
        r_conditions.append(CalendarEvent.start <= range_end)

    r_query = select(CalendarEvent).where(and_(*r_conditions))
    r_result = await db.execute(r_query)
    recurring = [e.to_dict() for e in r_result.scalars().all()]

    # Expand recurring events into instances
    if recurring and range_start and range_end:
        expanded = expand_recurring_events(recurring, range_start, range_end)
    else:
        expanded = recurring

    all_events = non_recurring + expanded
    all_events.sort(key=lambda e: e["start"])
    return all_events


@router.post("/calendar")
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    reminder_offsets = _normalize_reminders(body.reminderMinutes, body.reminderMinutesList)
    event = CalendarEvent(
        user_id=user.id,
        title=body.title,
        description=body.description,
        start=datetime.fromisoformat(body.start),
        end=datetime.fromisoformat(body.end),
        all_day=body.allDay,
        color=body.color,
        category=body.category,
        recurrence=body.recurrence,
        goal_id=body.goalId,
        reminder_minutes=reminder_offsets[0] if reminder_offsets else None,
        reminder_minutes_list=json.dumps(reminder_offsets) if reminder_offsets else "",
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return JSONResponse(content=event.to_dict(), status_code=201)


@router.get("/calendar/categories")
async def get_categories(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CalendarEvent.category)
        .where(
            CalendarEvent.user_id == user.id,
            CalendarEvent.category != "",
            CalendarEvent.category.isnot(None),
        )
        .distinct()
        .order_by(CalendarEvent.category)
    )
    return [row[0] for row in result.all()]


@router.get("/calendar/{id}")
async def get_event(
    id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == id, CalendarEvent.user_id == user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event.to_dict()


@router.put("/calendar/{id}")
async def update_event(
    id: int,
    body: EventUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == id, CalendarEvent.user_id == user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if body.title is not None:
        event.title = body.title
    if body.description is not None:
        event.description = body.description
    if body.start is not None:
        event.start = datetime.fromisoformat(body.start)
    if body.end is not None:
        event.end = datetime.fromisoformat(body.end)
    if body.allDay is not None:
        event.all_day = body.allDay
    if body.color is not None:
        event.color = body.color
    if body.category is not None:
        event.category = body.category
    if body.recurrence is not None:
        event.recurrence = body.recurrence
    field_names = getattr(body, "model_fields_set", set())

    if "goalId" in field_names:
        event.goal_id = body.goalId
    if "reminderMinutesList" in field_names or "reminderMinutes" in field_names:
        reminder_offsets = _normalize_reminders(
            body.reminderMinutes,
            body.reminderMinutesList if "reminderMinutesList" in field_names else None,
        )
        event.reminder_minutes = reminder_offsets[0] if reminder_offsets else None
        event.reminder_minutes_list = json.dumps(reminder_offsets) if reminder_offsets else ""

    await db.flush()
    await db.refresh(event)
    return event.to_dict()


@router.delete("/calendar/{id}")
async def delete_event(
    id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == id, CalendarEvent.user_id == user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(event)
    await db.flush()
    return {"message": "Event deleted"}
