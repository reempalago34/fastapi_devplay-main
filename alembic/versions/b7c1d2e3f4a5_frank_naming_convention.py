"""frank_naming_convention

Renombra los constraints UNIQUE para que sigan la convencion de nombres
definida en `app/models/base.py` (NAMING_CONVENTION).

Revision ID: b7c1d2e3f4a5
Revises: 12affbf632e2
Create Date: 2026-10-02

Por que esto es necesario
-------------------------
PostgreSQL inventa nombres para los constraints sin nombre explicito
(`Beta_postId_key`, `User_email_key`...). Esos nombres dependen del ORDEN en
que se creo cada constraint, asi que en otro entorno (produccion, pruebas,
la de un companero) salen distintos.

`alembic revision --autogenerate` compara por NOMBRE. Ve `uq_beta_post_id` en
el modelo y `Beta_postId_key` en la base, y concludes que hay que quitar uno y
volver a crear el otro: genera un DROP + ADD que reconstruye el indice sobre
la tabla. Con datos grandes eso toma lock y no hace falta.

La operacion correcta es `ALTER TABLE ... RENAME CONSTRAINT`, que en PostgreSQL:

- no reconstruye el indice (es solo metadatos),
- no bloquea escrituras de forma apreciable,
- no toca ni una fila de datos,
- es instantanea.

Este archivo deja el diff de autogenerate en cero, de modo que la proxima
migracion que escriba cualquier persona describa un cambio REAL y no ruido.

Nombres verificados contra el catalogo (pg_constraint) en devplay_api.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b7c1d2e3f4a5'
down_revision: Union[str, None] = '12affbf632e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (tabla, nombre viejo, nombre nuevo)
#
# Los nombres nuevos NO son inventados: salen de la propia convencion
# `uq_%(table_name)s_%(column_0_N_name)s` aplicada a los modelos reales. Ojo:
# las tablas se llaman "Beta", "User", ... con mayuscula inicial, asi que el
# resultado conserva esa caja: `uq_Beta_postId`, `uq_User_email`.
# StorePurchase ya venia con nombre explicito en el modelo, asi que su
# constraint NO lo renombra la convencion (tiene nombre propio) y queda igual.
_RENAMES: tuple[tuple[str, str, str], ...] = (
    ("Beta", "Beta_postId_key", "uq_Beta_postId"),
    ("Poll", "Poll_postId_key", "uq_Poll_postId"),
    ("Stream", "Stream_postId_key", "uq_Stream_postId"),
    ("User", "User_email_key", "uq_User_email"),
    ("User", "User_username_key", "uq_User_username"),
)


def _rename_all(pairs: tuple[tuple[str, str, str], ...]) -> None:
    for table, old, new in pairs:
        # Se usa op.execute con el SQL a mano en vez de op.rename_constraint()
        # porque Alembic no tiene un helper portable para esto, y porque las
        # tablas se llaman con mayuscula inicial ("User", "Beta"): "User" es
        # palabra reservada en SQL y sin las comillas el DDL falla.
        op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old}" TO "{new}"')


def upgrade() -> None:
    _rename_all(_RENAMES)


def downgrade() -> None:
    # Vuelve a los nombres originales. Efectivamente reversible porque el
    # renombrado no destruye nada.
    _rename_all(
        tuple((table, new, old) for table, old, new in _RENAMES),
    )