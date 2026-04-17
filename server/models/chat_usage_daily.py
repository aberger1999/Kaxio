from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from server.models.base import Base


class ChatUsageDaily(Base):
    __tablename__ = "chat_usage_daily"
    __table_args__ = (UniqueConstraint("user_id", "usage_date", name="uq_chat_usage_daily_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
