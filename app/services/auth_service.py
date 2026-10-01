import logging
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import or_, select

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import RegisterRequest, ResetPasswordRequest, TokenResponse
from app.services.login_code_service import create_login_code, mask_email, verify_login_code
from app.utils.json_fields import dumps_json
from app.utils.mailer import send_mail, verification_code_email, welcome_email

logger = logging.getLogger("devplay.auth")


class EmailTakenError(ValueError):
    pass


class UsernameTakenError(ValueError):
    pass


def register_user(db, payload: RegisterRequest) -> User:
    """Crea la cuenta. Lanza EmailTakenError / UsernameTakenError si hay duplicado."""
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise EmailTakenError()
    if db.query(User).filter(User.username == payload.username).first():
        raise UsernameTakenError()

    user = User(
        email=payload.email.lower(),
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        age=payload.age,
        dev_coins=100,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.lower()).first()
    if user is None or user.is_guest:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


def update_profile(db, user: User, payload) -> User:
    """Aplica los campos enviados (solo los que no sean None)."""
    data = payload.model_dump(exclude_unset=True, by_alias=False)
    if "tags" in data:
        data["tags"] = dumps_json(data["tags"])
    for field, value in data.items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# -------------------- Registro con código de 6 dígitos ---------------------


def start_registration(db, payload: RegisterRequest) -> dict:
    """Crea la cuenta, genera el código de confirmación y responde (sin sesión).

    Honeypot: si el bot rellenó `website` respondemos ok falso y no creamos nada.
    """
    email = payload.email.lower()
    if payload.website and payload.website.strip():
        logger.warning("[register] honeypot activado (%s) — posible bot", mask_email(email))
        return {
            "ok": True,
            "id": "ignored",
            "username": payload.username,
            "sent_to": mask_email(email),
            "demo_code": None,
        }

    existing = db.scalar(
        select(User).where(or_(User.email == email, User.username == payload.username))
    )
    if existing is not None:
        raise EmailTakenError() if existing.email == email else UsernameTakenError()

    user = register_user(db, payload)
    demo_code = send_verification_code(db, user, "confirmar tu cuenta de DevPlay")
    return {
        "ok": True,
        "id": user.id,
        "username": user.username,
        "sent_to": mask_email(user.email),
        "demo_code": demo_code,
    }


def send_verification_code(db, user: User, purpose: str) -> str | None:
    """Genera el código y lo envía. Devuelve `demoCode` si no hay SMTP (modo demo)."""
    code = create_login_code(db, user.id)  # lanza TooManyCodesError por antispam
    subject, html = verification_code_email(user.username, code, purpose)
    sent = send_mail(to=user.email, subject=subject, html=html)
    if not sent:
        logger.info("[register] Código para %s: %s", user.email, code)
    # En prod jamás se filtra el código (el original lo devolvía si fallaba SMTP)
    if sent or get_settings().app_env == "prod":
        return None
    return code


def find_verifiable_user(db, email: str) -> User | None:
    """Usuario con contraseña propia (no invitado). None si no existe."""
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or user.is_guest or not user.password_hash:
        return None
    return user


def verify_register(db, user: User, code: str) -> None:
    """Valida el código de registro. Lanza ValueError con el mensaje genérico."""
    if not verify_login_code(db, user.id, code):
        raise ValueError("Código incorrecto o expirado. Revisa tu correo.")


# --------------------- Recuperación de contraseña --------------------------


def forgot_password(db, email: str) -> dict:
    """Paso 1: envía un código de recuperación. Siempre responde ok (anti-enumeración)."""
    user = find_verifiable_user(db, email)
    if user is None:
        return {
            "ok": True,
            "message": "Si el email existe, recibirás un código de recuperación",
            "sent_to": None,
            "demo_code": None,
        }

    demo_code = send_verification_code(db, user, "restablecer tu contraseña de DevPlay")
    return {
        "ok": True,
        "message": "Si el email existe, recibirás un código de recuperación",
        "sent_to": mask_email(user.email),
        "demo_code": demo_code,
    }


def reset_password(db, payload: ResetPasswordRequest) -> None:
    """Paso 2: valida el código (o el enlace legacy con token) y guarda la clave."""
    if payload.email and payload.code:
        user = find_verifiable_user(db, payload.email)
        if user is None or not verify_login_code(db, user.id, payload.code):
            raise ValueError("Código incorrecto o expirado")
        _set_new_password(db, user, payload.password)
        return

    if payload.token:
        user = db.scalar(
            select(User).where(
                User.reset_token == payload.token,
                User.reset_token_expiry.is_not(None),
                User.reset_token_expiry > datetime.now(UTC),
            )
        )
        if user is None:
            raise ValueError("El enlace de recuperación es inválido o ha expirado")
        _set_new_password(db, user, payload.password)
        return

    raise ValueError("Datos inválidos. La contraseña debe tener mínimo 6 caracteres.")


def _set_new_password(db, user: User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.add(user)
    db.commit()


# -------------------------------- Invitados --------------------------------

GUEST_USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


def create_guest(db, username: str | None) -> User:
    """Cuenta de invitado (solo lectura). El nombre inválido se ignora."""
    base = username if username and GUEST_USERNAME_PATTERN.match(username) else None
    base = base or f"Invitado-{uuid.uuid4().hex[:5]}"

    final = base
    attempt = 0
    while db.scalar(select(User).where(User.username == final)) is not None:
        attempt += 1
        final = f"{base}{attempt}"
        if attempt > 20:
            final = f"{base}-{uuid.uuid4().hex[:6]}"
            break

    guest = User(
        email=f"guest-{uuid.uuid4()}@devplay.guest",
        username=final,
        password_hash="guest-no-password",
        role="USER",
        is_guest=True,
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


__all__ = [
    "EmailTakenError",
    "UsernameTakenError",
    "register_user",
    "authenticate",
    "issue_tokens",
    "update_profile",
    "start_registration",
    "send_verification_code",
    "find_verifiable_user",
    "verify_register",
    "forgot_password",
    "reset_password",
    "create_guest",
    "welcome_email",
]
