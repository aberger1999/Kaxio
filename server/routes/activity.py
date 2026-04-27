from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import get_current_user
from server.models.note import Note
from server.models.goal import Goal
from server.models.calendar_event import CalendarEvent
from server.models.journal import JournalEntry
from server.models.habit import HabitLog, CustomHabit, CustomHabitLog
from server.models.thought import ThoughtPost
from server.models.focus import FocusSession

router = APIRouter(prefix="")

CATEGORY_LABELS = {
    "sleep": "Sleep",
    "fitness": "Fitness",
    "finance": "Finance",
    "diet_health": "Diet & Health",
}


def _feed_item(
    item_type: str,
    action: str,
    description: str,
    timestamp: str,
    href: str,
    target_id: int | None = None,
):
    """Build a consistent activity-feed payload with a frontend destination."""
    item = {
        "type": item_type,
        "action": action,
        "description": description,
        "timestamp": timestamp,
        "href": href,
    }
    if target_id is not None:
        item["targetId"] = target_id
    return item


def _week_bounds():
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


@router.get("/activity-feed")
async def get_activity_feed(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    monday, sunday = _week_bounds()
    mon_dt = datetime.combine(monday, datetime.min.time())
    sun_dt = datetime.combine(sunday, datetime.max.time())

    items = []

    # Notes created or updated this week
    result = await db.execute(
        select(Note).where(
            Note.user_id == user.id,
            or_(
                and_(Note.created_at >= mon_dt, Note.created_at <= sun_dt),
                and_(Note.updated_at >= mon_dt, Note.updated_at <= sun_dt),
            ),
        )
    )
    for n in result.scalars().all():
        created_this_week = n.created_at and mon_dt <= n.created_at <= sun_dt
        updated_this_week = n.updated_at and mon_dt <= n.updated_at <= sun_dt
        if created_this_week:
            items.append(_feed_item(
                "note",
                "created",
                f'Created note "{n.title}"',
                n.created_at.isoformat(),
                f"/notes/{n.id}",
                n.id,
            ))
        if updated_this_week and n.updated_at != n.created_at:
            items.append(_feed_item(
                "note",
                "updated",
                f'Edited note "{n.title}"',
                n.updated_at.isoformat(),
                f"/notes/{n.id}",
                n.id,
            ))

    # Goals created or updated this week
    result = await db.execute(
        select(Goal).where(
            Goal.user_id == user.id,
            or_(
                and_(Goal.created_at >= mon_dt, Goal.created_at <= sun_dt),
                and_(Goal.updated_at >= mon_dt, Goal.updated_at <= sun_dt),
            ),
        )
    )
    for g in result.scalars().all():
        created_this_week = g.created_at and mon_dt <= g.created_at <= sun_dt
        updated_this_week = g.updated_at and mon_dt <= g.updated_at <= sun_dt
        if created_this_week:
            items.append(_feed_item(
                "goal",
                "created",
                f'Created goal "{g.title}"',
                g.created_at.isoformat(),
                f"/goals/{g.id}",
                g.id,
            ))
        if updated_this_week and g.updated_at != g.created_at:
            items.append(_feed_item(
                "goal",
                "updated",
                f'Updated goal "{g.title}" ({g.progress}%)',
                g.updated_at.isoformat(),
                f"/goals/{g.id}",
                g.id,
            ))

    # Calendar events created this week
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.user_id == user.id,
            CalendarEvent.created_at >= mon_dt,
            CalendarEvent.created_at <= sun_dt,
        )
    )
    for e in result.scalars().all():
        event_date = e.start.isoformat()[:10] if e.start else e.created_at.isoformat()[:10]
        items.append(_feed_item(
            "event",
            "created",
            f'Added event "{e.title}"',
            e.created_at.isoformat(),
            f"/calendar?date={event_date}&eventId={e.id}",
            e.id,
        ))

    # Journal entries written this week
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.user_id == user.id,
            JournalEntry.date >= monday,
            JournalEntry.date <= sunday,
        )
    )
    for j in result.scalars().all():
        has_content = bool(j.morning_intentions or j.content or j.evening_reflection)
        if has_content:
            ts = j.updated_at or j.created_at
            items.append(_feed_item(
                "journal",
                "written",
                f'Wrote journal for {j.date.strftime("%A, %b %d")}',
                ts.isoformat() if ts else j.date.isoformat(),
                f"/journal?date={j.date.isoformat()}",
                j.id,
            ))

    # Habit logs this week
    result = await db.execute(
        select(HabitLog).where(
            HabitLog.user_id == user.id,
            HabitLog.date >= monday,
            HabitLog.date <= sunday,
        )
    )
    for h in result.scalars().all():
        if h.is_completed:
            label = CATEGORY_LABELS.get(h.category, h.category)
            ts = h.updated_at or h.created_at
            items.append(_feed_item(
                "habit",
                "logged",
                f'Logged {label} habit for {h.date.strftime("%A")}',
                ts.isoformat() if ts else h.date.isoformat(),
                f"/habits?date={h.date.isoformat()}&category={h.category}",
                h.id,
            ))

    # Custom habit logs this week
    result = await db.execute(
        select(CustomHabitLog).where(
            CustomHabitLog.user_id == user.id,
            CustomHabitLog.date >= monday,
            CustomHabitLog.date <= sunday,
        )
    )
    custom_logs = result.scalars().all()
    habit_cache = {}
    for cl in custom_logs:
        if not cl.value or cl.value == "false":
            continue
        if cl.custom_habit_id not in habit_cache:
            habit_result = await db.execute(
                select(CustomHabit).where(CustomHabit.id == cl.custom_habit_id)
            )
            habit = habit_result.scalar_one_or_none()
            habit_cache[cl.custom_habit_id] = habit.name if habit else "Custom habit"
        name = habit_cache[cl.custom_habit_id]
        items.append(_feed_item(
            "habit",
            "logged",
            f'Logged "{name}" for {cl.date.strftime("%A")}',
            cl.created_at.isoformat() if cl.created_at else cl.date.isoformat(),
            f"/habits?date={cl.date.isoformat()}&habitId={cl.custom_habit_id}",
            cl.id,
        ))

    # Thought posts created or updated this week
    result = await db.execute(
        select(ThoughtPost).where(
            ThoughtPost.user_id == user.id,
            or_(
                and_(ThoughtPost.created_at >= mon_dt, ThoughtPost.created_at <= sun_dt),
                and_(ThoughtPost.updated_at >= mon_dt, ThoughtPost.updated_at <= sun_dt),
            ),
        )
    )
    for p in result.scalars().all():
        created_this_week = p.created_at and mon_dt <= p.created_at <= sun_dt
        updated_this_week = p.updated_at and mon_dt <= p.updated_at <= sun_dt
        if created_this_week:
            items.append(_feed_item(
                "thought",
                "created",
                f'Posted thought "{p.title}"',
                p.created_at.isoformat(),
                f"/thoughts?postId={p.id}",
                p.id,
            ))
        if updated_this_week and p.updated_at != p.created_at:
            items.append(_feed_item(
                "thought",
                "updated",
                f'Updated thought "{p.title}"',
                p.updated_at.isoformat(),
                f"/thoughts?postId={p.id}",
                p.id,
            ))

    # Focus sessions this week
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.user_id == user.id,
            FocusSession.created_at >= mon_dt,
            FocusSession.created_at <= sun_dt,
        )
    )
    for fs in result.scalars().all():
        duration_min = (fs.actual_duration or 0) // 60
        title = fs.title or "Untitled session"
        items.append(_feed_item(
            "focus",
            fs.status,
            f'Focus session: "{title}" ({duration_min}min, {fs.status})',
            fs.created_at.isoformat(),
            f"/focus?sessionId={fs.id}",
            fs.id,
        ))

    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return items
