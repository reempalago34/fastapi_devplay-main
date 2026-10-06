from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, MetaData, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# ============================================================
#  Convenciones de nombres para constraints e índices
# ============================================================
#  Sin esto, PostgreSQL inventa nombres: `user_1_fkey`, `user_2_fkey`...
#  esos nombres dependen del ORDEN de creación, así que en otro entorno
#  (producción vs pruebas) salen distintos y Alembic cree que hay cambios
#  que nunca hiciste (drift). Con la convención los nombres salen
#  deterministas y las migraciones se pueden aplicar en cualquier lado.
#
#  El módulo 01 de la guía de migraciones lo llama "vital" por esto mismo.
# ============================================================

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def new_id() -> str:
    """Equivalente a cuid() de Prisma: id único en texto plano."""
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    """Base declarativa con Metadata que conoce las convenciones de nombres.

    Importar `Base` es lo único que necesitan los modelos: al heredar de aquí,
    todas sus tablas, índices y constraints salen con el nombre correcto.
    """

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def id_pk() -> Mapped[str]:
    return mapped_column(String(40), primary_key=True, default=new_id)


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TimestampMixin(CreatedAtMixin):
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
