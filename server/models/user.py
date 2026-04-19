from datetime import datetime, timezone
from sqlalchemy import Integer, String, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from server.models.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(btrim(first_name)) > 0", name="ck_users_first_name_not_blank"),
        CheckConstraint("length(btrim(last_name)) > 0", name="ck_users_last_name_not_blank"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    @property
    def display_name(self) -> str:
        last = (self.last_name or "").strip()
        full_name = f"{self.first_name} {last}".strip()
        return full_name or self.first_name

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.display_name,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "email": self.email,
            "timezone": self.timezone,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
