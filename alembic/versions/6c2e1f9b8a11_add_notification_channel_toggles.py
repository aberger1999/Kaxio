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


def upgrade() -> None:
    op.add_column(
        "notification_preferences",
        sa.Column(
            "in_app_notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
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
    op.drop_column("notification_preferences", "email_notifications_enabled")
    op.drop_column("notification_preferences", "in_app_notifications_enabled")
