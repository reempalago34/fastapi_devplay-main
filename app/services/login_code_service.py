"""Códigos de 6 dígitos de un solo uso enviados por correo 🔐

Port de devplay-main/src/lib/login-code.ts:
- el código se guarda hasheado (bcrypt), nunca en texto plano
- caduca en 10 minutos y sirve una sola vez
- máx. 5 intentos por código
- máx. 5 códigos por cuenta cada 15 minutos (antispam de correos)
"""

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from app.core.security import hash_password, verify_password
from app.models.auth import LoginCode

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
MAX_CODES_PER_WINDOW = 5
WINDOW = timedelta(minutes=15)


class TooManyCodesError(Exception):
    """Se superó el antispam de códigos (5 cada 15 minutos)."""


def create_login_code(db, user_id: str) -> str:
    """Genera un código, lo guarda hasheado y lo devuelve en claro."""
    recent = int(
        db.scalar(
            select(func.count())
            .select_from(LoginCode)
            .where(
                LoginCode.user_id == user_id,
                LoginCode.created_at >= datetime.now(UTC) - WINDOW,
            )
        )
        or 0
    )
    if recent >= MAX_CODES_PER_WINDOW:
        raise TooManyCodesError()

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        LoginCode(
            user_id=user_id,
            code_hash=hash_password(code),
            expires_at=datetime.now(UTC) + CODE_TTL,
        )
    )
    db.commit()
    return code


def verify_login_code(db, user_id: str, code: str) -> bool:
    """True si el código es válido; en caso contrario suma intento y devuelve False."""
    clean = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(clean) != 6:
        return False

    record = db.scalar(
        select(LoginCode)
        .where(
            LoginCode.user_id == user_id,
            LoginCode.used_at.is_(None),
            LoginCode.expires_at > datetime.now(UTC),
        )
        .order_by(LoginCode.created_at.desc())
    )
    if record is None or record.attempts >= MAX_ATTEMPTS:
        return False

    if not verify_password(clean, record.code_hash):
        record.attempts += 1
        db.commit()
        return False

    # Un solo uso: se marca y se limpian los códigos ya usados de la cuenta.
    # El flush va primero: sin él, el delete por criterio (usedAt IS NOT NULL)
    # borraría el objeto de la sesión y el marcar usado se perdería.
    record.used_at = datetime.now(UTC)
    db.flush()
    db.execute(
        delete(LoginCode).where(
            LoginCode.user_id == user_id, LoginCode.used_at.is_not(None)
        ),
        execution_options={"synchronize_session": False},
    )
    db.commit()
    return True


def mask_email(email: str) -> str:
    """Oculta el email para la UI: fr**@gmail.com"""
    local, _, domain = email.partition("@")
    if not domain:
        return email
    visible = local[: min(2, len(local))]
    return f"{visible}{'*' * max(2, len(local) - 2)}@{domain}"
