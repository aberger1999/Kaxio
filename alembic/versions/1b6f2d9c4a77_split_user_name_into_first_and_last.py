"""split user name into first and last

Revision ID: 1b6f2d9c4a77
Revises: e4c1a9f08b22
Create Date: 2026-04-15 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1b6f2d9c4a77"
down_revision: Union[str, None] = "e4c1a9f08b22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _split_name(name: str) -> tuple[str, str]:
    parts = [part for part in (name or "").strip().split() if part]
    if not parts:
        return "User", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=True))

    connection = op.get_bind()
    users = connection.execute(sa.text("SELECT id, name FROM users")).mappings().all()
    for user in users:
        first_name, last_name = _split_name(user.get("name", ""))
        connection.execute(
            sa.text(
                "UPDATE users SET first_name = :first_name, last_name = :last_name WHERE id = :id"
            ),
            {
                "id": user["id"],
                "first_name": first_name,
                "last_name": last_name,
            },
        )

    op.alter_column("users", "first_name", existing_type=sa.String(length=100), nullable=False)
    op.alter_column("users", "last_name", existing_type=sa.String(length=100), nullable=False)
    op.create_check_constraint(
        "ck_users_first_name_not_blank",
        "users",
        "length(btrim(first_name)) > 0",
    )
    op.create_check_constraint(
        "ck_users_last_name_not_blank",
        "users",
        "length(btrim(last_name)) > 0",
    )
    op.drop_column("users", "name")


def downgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=200), nullable=True))
    op.drop_constraint("ck_users_last_name_not_blank", "users", type_="check")
    op.drop_constraint("ck_users_first_name_not_blank", "users", type_="check")

    connection = op.get_bind()
    users = connection.execute(
        sa.text("SELECT id, first_name, last_name FROM users")
    ).mappings().all()
    for user in users:
        first_name = (user.get("first_name") or "").strip()
        last_name = (user.get("last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip() or "User"
        connection.execute(
            sa.text("UPDATE users SET name = :name WHERE id = :id"),
            {"id": user["id"], "name": full_name},
        )

    op.alter_column("users", "name", existing_type=sa.String(length=200), nullable=False)
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
