from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse
from app.utils.json_fields import dumps_json


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


__all__ = [
    "EmailTakenError",
    "UsernameTakenError",
    "register_user",
    "authenticate",
    "issue_tokens",
    "update_profile",
]
