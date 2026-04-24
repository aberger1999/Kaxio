"""add email verification flag to users

Revision ID: 7a8b9c1d2e3f
Revises: 3f2b1a7c9d4e
Create Date: 2026-04-24 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a8b9c1d2e3f"
down_revision: Union[str, None] = "3f2b1a7c9d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = inspector.get_columns(table_name)
    return any(col.get("name") == column_name for col in columns)


def upgrade() -> None:
    if not _column_exists("users", "is_email_verified"):
        op.add_column(
            "users",
            sa.Column(
                "is_email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )


def downgrade() -> None:
    if _column_exists("users", "is_email_verified"):
        op.drop_column("users", "is_email_verified")
