"""add goal reminder days to notification preferences

Revision ID: 3f2b1a7c9d4e
Revises: 6c2e1f9b8a11
Create Date: 2026-04-23 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3f2b1a7c9d4e"
down_revision: Union[str, None] = "6c2e1f9b8a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("notification_preferences", "goal_reminder_days"):
        op.add_column(
            "notification_preferences",
            sa.Column(
                "goal_reminder_days",
                sa.String(length=100),
                nullable=False,
                server_default=sa.text("'1,2,3'"),
            ),
        )


def downgrade() -> None:
    if _column_exists("notification_preferences", "goal_reminder_days"):
        op.drop_column("notification_preferences", "goal_reminder_days")
