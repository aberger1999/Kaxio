"""
APScheduler-based background tasks for calendar notifications.

- check_event_reminders: runs every minute, triggers reminders for events
  whose start time minus reminder_minutes falls within the current minute.
- send_daily_schedules: runs every minute, checks if any user's configured
  reminder_time matches the current hour:minute and sends their daily schedule.
"""

import logging
from datetime import datetime, timedelta, timezone, time as dt_time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_

from server.database import AsyncSessionLocal
from server.models.calendar_event import CalendarEvent
from server.models.notification_preference import NotificationPreference
from server.models.user import User
from server.services.novu_service import trigger_event_reminder, trigger_daily_schedule

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_event_reminders():
    """Check for events that need a reminder notification right now."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=30)
    window_end = now + timedelta(seconds=30)

    async with AsyncSessionLocal() as db:
        try:
            # Find events with reminders set, where start - reminder_minutes is within the current minute window
            result = await db.execute(
                select(CalendarEvent, User)
                .join(User, CalendarEvent.user_id == User.id)
                .where(
                    and_(
                        CalendarEvent.reminder_minutes.isnot(None),
                        CalendarEvent.reminder_minutes > 0,
                        CalendarEvent.start > now,
                    )
                )
            )
            rows = result.all()

            for event, user in rows:
                reminder_time = event.start - timedelta(minutes=event.reminder_minutes)
                if window_start <= reminder_time <= window_end:
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
                            minutes_before=event.reminder_minutes,
                            user_name=user.display_name,
                        )
                        logger.info(
                            "Sent event reminder for '%s' to user %s",
                            event.title, user.id,
                        )
                    except Exception:
                        logger.exception(
                            "Failed to send event reminder for event %s", event.id
                        )
        except Exception:
            logger.exception("Error in check_event_reminders")


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


def start_scheduler():
    """Configure and start the APScheduler."""
    scheduler.add_job(check_event_reminders, "interval", minutes=1, id="event_reminders")
    scheduler.add_job(send_daily_schedules, "interval", minutes=1, id="daily_schedules")
    scheduler.start()
    logger.info("Notification scheduler started")


def stop_scheduler():
    """Shut down the scheduler."""
    scheduler.shutdown(wait=False)
    logger.info("Notification scheduler stopped")
