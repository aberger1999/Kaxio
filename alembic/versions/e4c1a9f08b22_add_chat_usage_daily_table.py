"""add chat usage daily table

Revision ID: e4c1a9f08b22
Revises: d5f9e4d2b611
Create Date: 2026-04-16 02:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4c1a9f08b22"
down_revision: Union[str, None] = "d5f9e4d2b611"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_usage_daily",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_chat_usage_daily_user_date"),
    )
    op.create_index(op.f("ix_chat_usage_daily_usage_date"), "chat_usage_daily", ["usage_date"], unique=False)
    op.create_index(op.f("ix_chat_usage_daily_user_id"), "chat_usage_daily", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_usage_daily_user_id"), table_name="chat_usage_daily")
    op.drop_index(op.f("ix_chat_usage_daily_usage_date"), table_name="chat_usage_daily")
    op.drop_table("chat_usage_daily")
