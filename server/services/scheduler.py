"""
APScheduler-based background tasks for calendar notifications.

- check_event_reminders: runs every minute, triggers reminders for events
  whose start time minus a configured reminder offset falls within the current minute.
- send_daily_schedules: runs every minute, checks if any user's configured
  reminder_time matches the current hour:minute and sends their daily schedule.
- check_goal_deadline_reminders: sends reminders for active goals whose
  deadline is N days out (configured via NOVU_GOAL_REMINDER_DAYS).
- send_habit_reminders: daily reminder for users with incomplete daily habits.
- send_journal_prompts: daily reminder if today's journal entry is still empty.
- send_weekly_reviews: weekly summary reminder (Sunday at reminder_time).
"""

import logging
from datetime import datetime, timedelta, timezone, time as dt_time, date as dt_date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_, or_

from server.database import AsyncSessionLocal
from server.models.calendar_event import CalendarEvent
from server.models.goal import Goal
from server.models.habit import HabitLog, CustomHabit, CustomHabitLog
from server.models.journal import JournalEntry
from server.models.notification_preference import (
    NotificationPreference,
    parse_goal_reminder_days,
    MAX_GOAL_REMINDER_DAY,
)
from server.models.user import User
from server.config import settings
from server.services.novu_service import (
    trigger_daily_schedule,
    trigger_event_reminder,
    trigger_goal_deadline,
    trigger_habit_reminder,
    trigger_journal_prompt,
    trigger_weekly_review,
)

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()
PRESET_HABIT_CATEGORY_LABELS: tuple[tuple[str, str], ...] = (
    ("sleep", "Sleep"),
    ("fitness", "Fitness"),
    ("finance", "Finance"),
    ("diet_health", "Diet & Health"),
)


def _subscriber_id_for_user(user: User) -> str:
    return user.email.strip().lower() if user.email else ""


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _goal_reminder_days_for_prefs(prefs: NotificationPreference) -> tuple[int, ...]:
    raw_days = (prefs.goal_reminder_days or "").strip()
    if raw_days:
        return tuple(parse_goal_reminder_days(raw_days))
    # Fallback to global env value to keep backwards-compatible behavior.
    return tuple(parse_goal_reminder_days(settings.NOVU_GOAL_REMINDER_DAYS))


def _is_current_reminder_minute(
    prefs: NotificationPreference, current_time: dt_time
) -> bool:
    reminder_time = prefs.reminder_time or dt_time(9, 0)
    return (
        reminder_time.hour == current_time.hour
        and reminder_time.minute == current_time.minute
    )


def _is_custom_habit_completed(tracking_type: str, raw_value: str) -> bool:
    value = (raw_value or "").strip()
    if not value:
        return False
    if tracking_type == "checkbox":
        return value.lower() == "true"
    try:
        return float(value) > 0
    except (TypeError, ValueError):
        return False


async def _first_pending_habit_name(
    db, user_id: int, check_date: dt_date
) -> str | None:
    preset_logs_result = await db.execute(
        select(HabitLog).where(
            HabitLog.user_id == user_id,
            HabitLog.date == check_date,
        )
    )
    preset_logs = {
        log.category: log
        for log in preset_logs_result.scalars().all()
    }
    for category, label in PRESET_HABIT_CATEGORY_LABELS:
        log = preset_logs.get(category)
        if log is None or not log.is_completed:
            return label

    custom_habits_result = await db.execute(
        select(CustomHabit)
        .where(
            CustomHabit.user_id == user_id,
            CustomHabit.is_active.is_(True),
            CustomHabit.frequency == "daily",
        )
        .order_by(CustomHabit.position, CustomHabit.id)
    )
    custom_habits = custom_habits_result.scalars().all()
    if not custom_habits:
        return None

    custom_habit_ids = [habit.id for habit in custom_habits]
    custom_logs_result = await db.execute(
        select(CustomHabitLog).where(
            CustomHabitLog.user_id == user_id,
            CustomHabitLog.date == check_date,
            CustomHabitLog.custom_habit_id.in_(custom_habit_ids),
        )
    )
    custom_logs = {
        log.custom_habit_id: log
        for log in custom_logs_result.scalars().all()
    }

    for habit in custom_habits:
        log = custom_logs.get(habit.id)
        if log is None or not _is_custom_habit_completed(habit.tracking_type, log.value):
            return habit.name

    return None


async def check_event_reminders():
    """Check for events that need a reminder notification right now."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=30)
    window_end = now + timedelta(seconds=30)

    async with AsyncSessionLocal() as db:
        try:
            # Find events with reminders set, where start - reminder offset is within this minute.
            result = await db.execute(
                select(CalendarEvent, User)
                .join(User, CalendarEvent.user_id == User.id)
                .where(
                    and_(
                        or_(
                            CalendarEvent.reminder_minutes.isnot(None),
                            CalendarEvent.reminder_minutes_list != "",
                        ),
                        CalendarEvent.start > now,
                    )
                )
            )
            rows = result.all()

            for event, user in rows:
                due_offsets = [
                    offset
                    for offset in event.reminder_offsets
                    if window_start <= event.start - timedelta(minutes=offset) <= window_end
                ]
                for minutes_before in due_offsets:
                    # Check if user has calendar reminders enabled
                    prefs_result = await db.execute(
                        select(NotificationPreference).where(
                            NotificationPreference.user_id == user.id
                        )
                    )
                    prefs = prefs_result.scalar_one_or_none()
                    if prefs and not prefs.calendar_reminders_enabled:
                        continue

                    try:
                        subscriber_id = user.email.strip().lower() if user.email else ""
                        if not subscriber_id:
                            logger.warning("Skipping event reminder: missing email for user %s", user.id)
                            continue
                        await trigger_event_reminder(
                            subscriber_id=subscriber_id,
                            event_title=event.title,
                            event_time=event.start.isoformat(),
                            minutes_before=minutes_before,
                            user_name=user.display_name,
                        )
                        logger.info(
                            "Sent event reminder for '%s' to user %s (%d minutes before)",
                            event.title, user.id, minutes_before,
                        )
                    except Exception:
                        logger.exception(
                            "Failed to send event reminder for event %s", event.id
                        )
        except Exception:
            logger.exception("Error in check_event_reminders")


async def check_goal_deadline_reminders():
    """
    Send reminders for goals due in configured N-day windows.

    Example: with NOVU_GOAL_REMINDER_DAYS=1,2,3 a goal due on Friday
    sends reminders on Tuesday, Wednesday, and Thursday at reminder_time.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    current_time = dt_time(now.hour, now.minute)
    horizon_day = today + timedelta(days=MAX_GOAL_REMINDER_DAY)
    horizon_end = datetime.combine(
        horizon_day + timedelta(days=1),
        dt_time(0, 0, tzinfo=timezone.utc),
    )
    today_start = datetime.combine(today, dt_time(0, 0, tzinfo=timezone.utc))

    async with AsyncSessionLocal() as db:
        try:
            rows_result = await db.execute(
                select(NotificationPreference, User, Goal)
                .join(User, NotificationPreference.user_id == User.id)
                .join(Goal, Goal.user_id == User.id)
                .where(
                    NotificationPreference.goal_reminders_enabled.is_(True),
                    Goal.status == "active",
                    Goal.target_date.isnot(None),
                    Goal.target_date >= today_start,
                    Goal.target_date < horizon_end,
                )
            )
            rows = rows_result.all()

            for prefs, user, goal in rows:
                if not _is_current_reminder_minute(prefs, current_time):
                    continue
                reminder_days = set(_goal_reminder_days_for_prefs(prefs))
                if not reminder_days:
                    continue

                due_date = _to_utc(goal.target_date).date()
                days_until_due = (due_date - today).days
                if days_until_due not in reminder_days:
                    continue

                subscriber_id = _subscriber_id_for_user(user)
                if not subscriber_id:
                    logger.warning("Skipping goal reminder: missing email for user %s", user.id)
                    continue

                try:
                    await trigger_goal_deadline(
                        subscriber_id=subscriber_id,
                        goal_name=goal.title,
                        deadline=due_date.isoformat(),
                    )
                    logger.info(
                        "Sent goal deadline reminder for '%s' (%d days out) to user %s",
                        goal.title,
                        days_until_due,
                        user.id,
                    )
                except Exception:
                    logger.exception(
                        "Failed to send goal deadline reminder for goal %s", goal.id
                    )
        except Exception:
            logger.exception("Error in check_goal_deadline_reminders")


async def send_daily_schedules():
    """Send daily schedule summaries to users whose reminder_time matches now."""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_minute = now.minute
    current_time = dt_time(current_hour, current_minute)

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    async with AsyncSessionLocal() as db:
        try:
            # Find users whose reminder_time matches the current UTC minute
            prefs_result = await db.execute(
                select(NotificationPreference, User)
                .join(User, NotificationPreference.user_id == User.id)
                .where(
                    and_(
                        NotificationPreference.calendar_reminders_enabled.is_(True),
                        NotificationPreference.reminder_time == current_time,
                    )
                )
            )
            rows = prefs_result.all()

            for prefs, user in rows:
                try:
                    # Fetch today's events for this user
                    events_result = await db.execute(
                        select(CalendarEvent)
                        .where(
                            and_(
                                CalendarEvent.user_id == user.id,
                                CalendarEvent.start >= today_start,
                                CalendarEvent.start < today_end,
                            )
                        )
                        .order_by(CalendarEvent.start)
                    )
                    events = events_result.scalars().all()

                    if not events:
                        continue

                    events_today = [
                        {
                            "title": e.title,
                            "time": e.start.strftime("%I:%M %p") if e.start else "",
                        }
                        for e in events
                    ]

                    subscriber_id = user.email.strip().lower() if user.email else ""
                    if not subscriber_id:
                        logger.warning("Skipping daily schedule: missing email for user %s", user.id)
                        continue

                    await trigger_daily_schedule(
                        subscriber_id=subscriber_id,
                        events_today=events_today,
                        total_events=len(events),
                        user_name=user.display_name,
                    )
                    logger.info("Sent daily schedule to user %s (%d events)", user.id, len(events))
                except Exception:
                    logger.exception("Failed to send daily schedule to user %s", user.id)
        except Exception:
            logger.exception("Error in send_daily_schedules")


async def send_habit_reminders():
    """Send daily habit reminders to users with pending habits."""
    now = datetime.now(timezone.utc)
    today = now.date()
    current_time = dt_time(now.hour, now.minute)

    async with AsyncSessionLocal() as db:
        try:
            rows_result = await db.execute(
                select(NotificationPreference, User)
                .join(User, NotificationPreference.user_id == User.id)
                .where(NotificationPreference.habit_reminders_enabled.is_(True))
            )
            rows = rows_result.all()

            for prefs, user in rows:
                if not _is_current_reminder_minute(prefs, current_time):
                    continue

                pending_habit_name = await _first_pending_habit_name(
                    db=db,
                    user_id=user.id,
                    check_date=today,
                )
                if not pending_habit_name:
                    continue

                subscriber_id = _subscriber_id_for_user(user)
                if not subscriber_id:
                    logger.warning("Skipping habit reminder: missing email for user %s", user.id)
                    continue

                try:
                    await trigger_habit_reminder(
                        subscriber_id=subscriber_id,
                        habit_name=pending_habit_name,
                    )
                    logger.info(
                        "Sent habit reminder '%s' to user %s",
                        pending_habit_name,
                        user.id,
                    )
                except Exception:
                    logger.exception("Failed to send habit reminder for user %s", user.id)
        except Exception:
            logger.exception("Error in send_habit_reminders")


async def send_journal_prompts():
    """Send a daily prompt when today's journal entry is still empty."""
    now = datetime.now(timezone.utc)
    today = now.date()
    current_time = dt_time(now.hour, now.minute)

    async with AsyncSessionLocal() as db:
        try:
            rows_result = await db.execute(
                select(NotificationPreference, User)
                .join(User, NotificationPreference.user_id == User.id)
                .where(NotificationPreference.journal_reminders_enabled.is_(True))
            )
            rows = rows_result.all()

            for prefs, user in rows:
                if not _is_current_reminder_minute(prefs, current_time):
                    continue

                entry_result = await db.execute(
                    select(JournalEntry).where(
                        JournalEntry.user_id == user.id,
                        JournalEntry.date == today,
                    )
                )
                entry = entry_result.scalar_one_or_none()
                if entry:
                    has_content = any(
                        (
                            (entry.morning_intentions or "").strip(),
                            (entry.content or "").strip(),
                            (entry.evening_reflection or "").strip(),
                        )
                    )
                    if has_content:
                        continue

                subscriber_id = _subscriber_id_for_user(user)
                if not subscriber_id:
                    logger.warning("Skipping journal prompt: missing email for user %s", user.id)
                    continue

                try:
                    await trigger_journal_prompt(subscriber_id=subscriber_id)
                    logger.info("Sent journal prompt to user %s", user.id)
                except Exception:
                    logger.exception("Failed to send journal prompt to user %s", user.id)
        except Exception:
            logger.exception("Error in send_journal_prompts")


async def send_weekly_reviews():
    """Send weekly review notifications on Sunday at the user's reminder_time."""
    now = datetime.now(timezone.utc)
    if now.weekday() != 6:  # Sunday
        return
    current_time = dt_time(now.hour, now.minute)

    async with AsyncSessionLocal() as db:
        try:
            rows_result = await db.execute(
                select(NotificationPreference, User)
                .join(User, NotificationPreference.user_id == User.id)
                .where(NotificationPreference.weekly_review_enabled.is_(True))
            )
            rows = rows_result.all()

            for prefs, user in rows:
                if not _is_current_reminder_minute(prefs, current_time):
                    continue

                subscriber_id = _subscriber_id_for_user(user)
                if not subscriber_id:
                    logger.warning("Skipping weekly review: missing email for user %s", user.id)
                    continue

                try:
                    await trigger_weekly_review(subscriber_id=subscriber_id)
                    logger.info("Sent weekly review reminder to user %s", user.id)
                except Exception:
                    logger.exception("Failed to send weekly review to user %s", user.id)
        except Exception:
            logger.exception("Error in send_weekly_reviews")


def start_scheduler():
    """Configure and start the APScheduler."""
    scheduler.add_job(check_event_reminders, "interval", minutes=1, id="event_reminders")
    scheduler.add_job(send_daily_schedules, "interval", minutes=1, id="daily_schedules")
    scheduler.add_job(
        check_goal_deadline_reminders, "interval", minutes=1, id="goal_deadline_reminders"
    )
    scheduler.add_job(send_habit_reminders, "interval", minutes=1, id="habit_reminders")
    scheduler.add_job(send_journal_prompts, "interval", minutes=1, id="journal_prompts")
    scheduler.add_job(send_weekly_reviews, "interval", minutes=1, id="weekly_reviews")
    scheduler.start()
    logger.info("Notification scheduler started")


def stop_scheduler():
    """Shut down the scheduler."""
    scheduler.shutdown(wait=False)
    logger.info("Notification scheduler stopped")
