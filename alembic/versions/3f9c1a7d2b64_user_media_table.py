"""user_media_table

Crea la tabla `UserMedia` (archivos subidos por el usuario: avatar, portada,
galería) y su índice. El cliente Flutter usa estos endpoints para subir y
listar sus medios.

Revision ID: 3f9c1a7d2b64
Revises: b7c1d2e3f4a5
Create Date: 2026-10-21

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3f9c1a7d2b64"
down_revision: Union[str, None] = "b7c1d2e3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "UserMedia",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("userId", sa.String(length=40), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("postId", sa.String(length=40), nullable=True),
        sa.Column(
            "createdAt",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["userId"],
            ["User.id"],
            name=op.f("fk_UserMedia_userId_User"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_UserMedia")),
    )
    op.create_index("ix_UserMedia_userId", "UserMedia", ["userId"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_UserMedia_userId", table_name="UserMedia")
    op.drop_table("UserMedia")
