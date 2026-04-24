"""add notification channel toggles

Revision ID: 6c2e1f9b8a11
Revises: 1b6f2d9c4a77
Create Date: 2026-04-19 02:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6c2e1f9b8a11"
down_revision: Union[str, None] = "1b6f2d9c4a77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("notification_preferences", "in_app_notifications_enabled"):
        op.add_column(
            "notification_preferences",
            sa.Column(
                "in_app_notifications_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )
    if not _column_exists("notification_preferences", "email_notifications_enabled"):
        op.add_column(
            "notification_preferences",
            sa.Column(
                "email_notifications_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )


def downgrade() -> None:
    if _column_exists("notification_preferences", "email_notifications_enabled"):
        op.drop_column("notification_preferences", "email_notifications_enabled")
    if _column_exists("notification_preferences", "in_app_notifications_enabled"):
        op.drop_column("notification_preferences", "in_app_notifications_enabled")
