"""Lógica de negocio de seguridad y moderación.

Port desde devplay-main/src/app/api/devplay/security/*/route.ts.
Se mantienen los mismos códigos de estado y mensajes (o genéricos cuando el
original protege contra enumeración).
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.auth import AccountDeletionCode, LoginEvent
from app.models.chat import Notification
from app.models.social import Block, Follow, Report
from app.models.user import User
from app.utils.rate_limit import check_rate_limit

logger = logging.getLogger("devplay.security")

CODE_TTL = timedelta(minutes=10)


# ---------- Bloqueos ----------


def block_user(db: Session, current_user_id: str, blocked_id: str) -> None:
    if blocked_id == current_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Inválido")

    target = db.scalar(select(User).where(User.id == blocked_id))
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    existing = db.scalar(
        select(Block).where(Block.blocker_id == current_user_id, Block.blocked_id == blocked_id)
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya bloqueaste a este usuario")

    # Un bloqueo elimina cualquier relación de seguimiento mutua
    mutual = or_(
        and_(Follow.follower_id == current_user_id, Follow.followee_id == blocked_id),
        and_(Follow.follower_id == blocked_id, Follow.followee_id == current_user_id),
    )
    db.execute(delete(Follow).where(mutual))
    db.add(Block(blocker_id=current_user_id, blocked_id=blocked_id))
    db.commit()


def unblock_user(db: Session, current_user_id: str, blocked_id: str) -> None:
    db.execute(
        delete(Block).where(
            Block.blocker_id == current_user_id, Block.blocked_id == blocked_id
        )
    )
    db.commit()


def list_blocked(db: Session, current_user_id: str) -> list[dict]:
    rows = db.execute(
        select(Block, User)
        .join(User, User.id == Block.blocked_id)
        .where(Block.blocker_id == current_user_id)
        .order_by(Block.created_at.desc())
    ).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "bio": user.bio,
            "role": user.role,
            "tags": user.tags,
            "blockedAt": block.created_at,
        }
        for block, user in rows
    ]


# ---------- Reportes ----------


def create_report(db: Session, current_user_id: str, payload) -> None:
    check_rate_limit(f"report:{current_user_id}", limit=5, window_seconds=60)

    existing = db.scalar(
        select(Report).where(
            Report.reporter_id == current_user_id,
            Report.entity_id == payload.entity_id,
            Report.type == payload.type.value,
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya reportaste este contenido")

    db.add(
        Report(
            reporter_id=current_user_id,
            type=payload.type.value,
            entity_id=payload.entity_id,
            reason=payload.reason.value,
            description=payload.description,
        )
    )
    db.commit()


# ---------- Privacidad y contraseña ----------


def set_privacy(db: Session, user: User, is_private: bool) -> None:
    user.is_private = is_private
    db.add(user)
    db.commit()


def change_password(db: Session, user: User, payload) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Contraseña actual incorrecta")

    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    # type "LIKE": se reutiliza un tipo existente (el original hace lo mismo)
    db.add(
        Notification(
            user_id=user.id,
            from_user_id=user.id,
            type="LIKE",
            message="🔒 Tu contraseña fue cambiada correctamente. "
            "Si no fuiste tú, contacta soporte.",
            entity_id=user.id,
        )
    )
    db.commit()


def list_login_events(db: Session, user: User, limit: int = 20) -> list[LoginEvent]:
    return list(
        db.scalars(
            select(LoginEvent)
            .where(LoginEvent.user_id == user.id)
            .order_by(LoginEvent.created_at.desc())
            .limit(limit)
        )
    )


# ---------- Borrado de cuenta (3 pasos) ----------


def mask_email(email: str) -> str:
    name, _, domain = email.partition("@")
    if not domain:
        return "tu correo"
    visible = name[: min(2, len(name))]
    return f"{visible}{'•' * max(len(name) - len(visible), 2)}@{domain}"


def _latest_valid_code(db: Session, user_id: str) -> AccountDeletionCode | None:
    now = datetime.now(UTC)
    return db.scalar(
        select(AccountDeletionCode)
        .where(
            AccountDeletionCode.user_id == user_id,
            AccountDeletionCode.consumed.is_(False),
            AccountDeletionCode.expires_at > now,
        )
        .order_by(AccountDeletionCode.created_at.desc())
    )


def request_deletion_code(db: Session, user: User) -> dict:
    if user.is_guest:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Las cuentas de invitado no requieren eliminación por código",
        )

    db.execute(
        delete(AccountDeletionCode).where(
            AccountDeletionCode.user_id == user.id,
            AccountDeletionCode.consumed.is_(False),
        )
    )

    code = str(secrets.randbelow(900000) + 100000)
    expires_at = datetime.now(UTC) + CODE_TTL
    db.add(
        AccountDeletionCode(
            user_id=user.id,
            code_hash=hash_password(code),
            expires_at=expires_at,
        )
    )
    db.commit()

    # Sin SMTP configurado se registra en el log (mismo modo demo que el original)
    logger.info("Código de eliminación para %s: %s (válido 10 min)", user.email, code)

    return {
        "ok": True,
        "email": mask_email(user.email),
        "expiresAt": expires_at,
        "devCode": code,
    }


def verify_deletion_code(db: Session, user_id: str, code: str) -> None:
    record = _latest_valid_code(db, user_id)
    if record is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No hay un código válido. Pide uno nuevo."
        )
    if not bcrypt.checkpw(code.encode(), record.code_hash.encode()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Código incorrecto")


def confirm_deletion(db: Session, user: User, code: str, password: str, confirm: str) -> None:
    if confirm != "ELIMINAR MI CUENTA":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Debes escribir "ELIMINAR MI CUENTA" para confirmar',
        )

    record = _latest_valid_code(db, user.id)
    if record is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El código expiró. Pide uno nuevo.")
    if not bcrypt.checkpw(code.encode(), record.code_hash.encode()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Código incorrecto")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Contraseña incorrecta")

    record.consumed = True
    db.add(record)
    db.flush()  # persiste el consumo antes de borrar (la sesión va con autoflush off)
    # DELETE en núcleo: el cascado de las FK lo resuelve la BD y así no se
    # intenta "anular" la FK de los hijos cargados en la sesión (IntegrityError).
    db.execute(delete(User).where(User.id == user.id))
    db.commit()
    db.expire_all()
