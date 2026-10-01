"""Fábricas compartidas por los tests."""

from app.core.security import create_access_token, hash_password
from app.models.user import User

BASE = "/api/v1"


def make_user(db, email: str, username: str, password: str = "secret123") -> User:
    """Crea el usuario directamente en BD para no consumir el rate limit de
    /auth/register (5/min por IP) que ya usan los tests de auth."""
    user = User(
        email=email,
        username=username,
        password_hash=hash_password(password),
        full_name=username.title(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth(user: User) -> dict:
    """Cabecera Authorization con un access token válido (sin pasar por /login)."""
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}
