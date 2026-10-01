from datetime import datetime

from pydantic import Field, field_validator, model_validator

from app.core.enums import MediaKind, PostType
from app.schemas.base import ORMModel
from app.utils.json_fields import dumps_json, loads_json


class MediaItem(ORMModel):
    """Cada elemento de `mediaUrls` (guardado como JSON-string en la BD)."""

    url: str
    kind: MediaKind = MediaKind.IMAGE


class PostCreate(ORMModel):
    """Payload de POST /posts. Al menos debe haber contenido o media."""

    type: PostType = PostType.POST
    content: str | None = Field(default=None, max_length=5000)
    media: list[MediaItem] = Field(default_factory=list, max_length=4)

    @field_validator("content")
    @classmethod
    def _strip_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def _algo_que_decir(self):
        if self.type == PostType.POST and not self.content and not self.media:
            raise ValueError("A post needs content or media")
        return self


class PostUpdate(ORMModel):
    """Payload de PATCH /posts/{id}. Solo lo que se envía cambia."""

    content: str | None = Field(default=None, max_length=5000)
    media: list[MediaItem] | None = None


class AuthorSummary(ORMModel):
    id: str
    username: str
    full_name: str | None = None
    avatar: str | None = None


class PostOut(ORMModel):
    """Post tal como lo devuelve la API."""

    id: str
    type: PostType
    content: str | None = None
    media: list[MediaItem] = Field(default_factory=list, validation_alias="media_urls")
    repost_of_id: str | None = None
    author: AuthorSummary | None = None
    likes_count: int = 0
    comments_count: int = 0
    liked_by_me: bool = False
    bookmarked_by_me: bool = False
    created_at: datetime
    updated_at: datetime

    @field_validator("media", mode="before")
    @classmethod
    def _parse_media(cls, value):
        # `mediaUrls` se guarda como JSON-string (patrón Prisma): hay que parsearlo.
        if isinstance(value, str):
            parsed = loads_json(value, [])
            return parsed if isinstance(parsed, list) else []
        return value or []


class PostListOut(ORMModel):
    """Respuesta de GET /posts con paginación."""

    items: list[PostOut]
    total: int
    skip: int
    limit: int


class CommentCreate(ORMModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def _strip_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Comment cannot be empty")
        return stripped


class CommentOut(ORMModel):
    id: str
    post_id: str
    content: str
    author: AuthorSummary | None = None
    created_at: datetime


class ToggleOut(ORMModel):
    """Respuesta de likes/bookmarks: qué pasó y el nuevo conteo."""

    active: bool
    count: int


class RepostOut(ORMModel):
    """Respuesta de POST /posts/{id}/repost."""

    post: PostOut
    repost: PostOut


__all__ = [
    "AuthorSummary",
    "CommentCreate",
    "CommentOut",
    "MediaItem",
    "PostCreate",
    "PostListOut",
    "PostOut",
    "PostUpdate",
    "RepostOut",
    "ToggleOut",
    "dumps_json",
]