from datetime import time
from sqlalchemy import Boolean, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column
from server.models.base import Base

DEFAULT_GOAL_REMINDER_DAYS = (1, 2, 3)
MAX_GOAL_REMINDER_DAY = 30


def parse_goal_reminder_days(raw: str | None) -> list[int]:
    values: set[int] = set()
    for token in (raw or "").split(","):
        cleaned = token.strip()
        if not cleaned:
            continue
        try:
            day = int(cleaned)
        except ValueError:
            continue
        if 1 <= day <= MAX_GOAL_REMINDER_DAY:
            values.add(day)
    if values:
        return sorted(values)
    return list(DEFAULT_GOAL_REMINDER_DAYS)


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    habit_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    goal_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    journal_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    focus_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    weekly_review_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    calendar_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    in_app_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    goal_reminder_days: Mapped[str] = mapped_column(String(100), default="1,2,3")
    reminder_time: Mapped[time] = mapped_column(Time, default=time(9, 0))
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "habitRemindersEnabled": self.habit_reminders_enabled,
            "goalRemindersEnabled": self.goal_reminders_enabled,
            "journalRemindersEnabled": self.journal_reminders_enabled,
            "focusNotificationsEnabled": self.focus_notifications_enabled,
            "weeklyReviewEnabled": self.weekly_review_enabled,
            "calendarRemindersEnabled": self.calendar_reminders_enabled,
            "inAppNotificationsEnabled": self.in_app_notifications_enabled,
            "emailNotificationsEnabled": self.email_notifications_enabled,
            "goalReminderDays": parse_goal_reminder_days(self.goal_reminder_days),
            "reminderTime": self.reminder_time.strftime("%H:%M") if self.reminder_time else "09:00",
            "phoneNumber": self.phone_number,
        }
