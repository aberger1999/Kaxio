"""add multiple calendar reminders

Revision ID: b8c4f2a91d6e
Revises: 7a8b9c1d2e3f
Create Date: 2026-04-26 13:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8c4f2a91d6e"
down_revision: Union[str, None] = "7a8b9c1d2e3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("calendar_events", "reminder_minutes_list"):
        op.add_column(
            "calendar_events",
            sa.Column(
                "reminder_minutes_list",
                sa.Text(),
                nullable=False,
                server_default=sa.text("''"),
            ),
        )
        op.execute(
            """
            UPDATE calendar_events
            SET reminder_minutes_list = '[' || reminder_minutes::text || ']'
            WHERE reminder_minutes IS NOT NULL AND reminder_minutes > 0
            """
        )


def downgrade() -> None:
    if _column_exists("calendar_events", "reminder_minutes_list"):
        op.drop_column("calendar_events", "reminder_minutes_list")
