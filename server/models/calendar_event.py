from datetime import datetime, timezone
import json

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from server.models.base import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6")
    category: Mapped[str] = mapped_column(String(50), default="")
    recurrence: Mapped[str] = mapped_column(Text, default="")
    goal_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("goals.id"), nullable=True
    )
    reminder_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reminder_minutes_list: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @property
    def reminder_offsets(self) -> list[int]:
        """Return all reminder offsets, falling back to the legacy single value."""
        offsets: list[int] = []
        if self.reminder_minutes_list:
            try:
                raw_offsets = json.loads(self.reminder_minutes_list)
                if isinstance(raw_offsets, list):
                    offsets = [
                        int(offset)
                        for offset in raw_offsets
                        if isinstance(offset, (int, float, str)) and str(offset).isdigit()
                    ]
            except (TypeError, ValueError, json.JSONDecodeError):
                offsets = []

        if not offsets and self.reminder_minutes:
            offsets = [self.reminder_minutes]

        return sorted({offset for offset in offsets if offset > 0})

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "allDay": self.all_day,
            "color": self.color,
            "category": self.category,
            "recurrence": self.recurrence,
            "goalId": self.goal_id,
            "reminderMinutes": self.reminder_minutes,
            "reminderMinutesList": self.reminder_offsets,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
