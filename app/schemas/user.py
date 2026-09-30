from datetime import datetime

from pydantic import EmailStr, field_validator

from app.schemas.base import ORMModel
from app.utils.json_fields import loads_json


class UserMe(ORMModel):
    id: str
    email: EmailStr
    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    banner: str | None = None
    role: str
    language: str
    is_guest: bool
    is_private: bool
    tour_completed: bool
    dev_coins: int
    location: str | None = None
    website: str | None = None
    profession: str | None = None
    tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def _parse_tags(cls, value):
        # `tags` se guarda como JSON-string (patrón Prisma): hay que parsearlo.
        if isinstance(value, str):
            parsed = loads_json(value, [])
            return parsed if isinstance(parsed, list) else []
        return value


class UserPublic(ORMModel):
    """Perfil público mínimo (lo que ve cualquier visitante)."""

    id: str
    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    role: str
    is_private: bool
    created_at: datetime
