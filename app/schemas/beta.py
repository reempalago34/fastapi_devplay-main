from datetime import datetime

from pydantic import ConfigDict, Field, field_validator

from app.core.enums import BetaStatus, DownloadType, StreamPlatform
from app.schemas.base import ORMModel
from app.utils.json_fields import loads_json

_URL_MAX = 500


class BetaBase(ORMModel):
    """Base con los alias camelCase que usa el frontend (paridad con Prisma)."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class BetaCreate(BetaBase):
    """Payload de POST /betas. Crea el post de tipo BETA y su ficha."""

    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=1, max_length=8000)
    download_type: DownloadType = Field(default=DownloadType.LINK, alias="downloadType")
    beta_status: BetaStatus = Field(default=BetaStatus.OPEN_BETA, alias="betaStatus")
    external_url: str | None = Field(default=None, max_length=_URL_MAX, alias="externalUrl")
    file_url: str | None = Field(default=None, max_length=_URL_MAX, alias="fileUrl")
    file_size: int | None = Field(default=None, ge=0, alias="fileSize")
    file_name: str | None = Field(default=None, max_length=255, alias="fileName")
    genre: str | None = Field(default=None, max_length=64)
    version: str | None = Field(default=None, max_length=32)
    platforms: list[str] = Field(default_factory=list, max_length=10)
    tags: list[str] = Field(default_factory=list, max_length=15)
    requirements: str | None = Field(default=None, max_length=4000)
    changelog: str | None = Field(default=None, max_length=8000)
    install_instructions: str | None = Field(
        default=None, max_length=4000, alias="installInstructions"
    )
    cover_image: str | None = Field(default=None, max_length=_URL_MAX, alias="coverImage")
    screenshots: list[str] = Field(default_factory=list, max_length=10)
    external_platform: str | None = Field(default=None, max_length=64, alias="externalPlatform")


class BetaUpdate(BetaBase):
    """Payload de PATCH /betas/{id}. Solo se aplica lo enviado."""

    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, min_length=1, max_length=8000)
    download_type: DownloadType | None = Field(default=None, alias="downloadType")
    beta_status: BetaStatus | None = Field(default=None, alias="betaStatus")
    external_url: str | None = Field(default=None, max_length=_URL_MAX, alias="externalUrl")
    file_url: str | None = Field(default=None, max_length=_URL_MAX, alias="fileUrl")
    file_size: int | None = Field(default=None, ge=0, alias="fileSize")
    file_name: str | None = Field(default=None, max_length=255, alias="fileName")
    genre: str | None = Field(default=None, max_length=64)
    version: str | None = Field(default=None, max_length=32)
    platforms: list[str] | None = Field(default=None, max_length=10)
    tags: list[str] | None = Field(default=None, max_length=15)
    requirements: str | None = Field(default=None, max_length=4000)
    changelog: str | None = Field(default=None, max_length=8000)
    install_instructions: str | None = Field(
        default=None, max_length=4000, alias="installInstructions"
    )
    cover_image: str | None = Field(default=None, max_length=_URL_MAX, alias="coverImage")
    screenshots: list[str] | None = Field(default=None, max_length=10)
    external_platform: str | None = Field(default=None, max_length=64, alias="externalPlatform")


class BetaOut(BetaBase):
    id: str
    post_id: str = Field(alias="postId")
    title: str
    description: str
    download_type: DownloadType = Field(alias="downloadType")
    beta_status: BetaStatus = Field(alias="betaStatus")
    file_url: str | None = Field(default=None, alias="fileUrl")
    file_size: int | None = Field(default=None, alias="fileSize")
    file_name: str | None = Field(default=None, alias="fileName")
    external_url: str | None = Field(default=None, alias="externalUrl")
    genre: str | None = None
    version: str | None = None
    platforms: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    requirements: str | None = None
    changelog: str | None = None
    install_instructions: str | None = Field(default=None, alias="installInstructions")
    cover_image: str | None = Field(default=None, alias="coverImage")
    screenshots: list[str] = Field(default_factory=list)
    external_platform: str | None = Field(default=None, alias="externalPlatform")
    downloads: int = 0
    created_at: datetime = Field(alias="createdAt")

    @field_validator("platforms", "tags", "screenshots", mode="before")
    @classmethod
    def _parse_json(cls, value):
        # Columnas JSON-guardadas-como-string (patrón Prisma).
        if isinstance(value, str):
            parsed = loads_json(value, [])
            return parsed if isinstance(parsed, list) else []
        return value or []


class BetaDownloadOut(BetaBase):
    """Respuesta de POST /betas/{id}/download: a dónde ir y con qué nombre."""

    beta_id: str = Field(alias="betaId")
    download_type: DownloadType = Field(alias="downloadType")
    url: str
    file_name: str | None = Field(default=None, alias="fileName")
    file_size: int | None = Field(default=None, alias="fileSize")
    downloads: int


class StreamGoLiveIn(BetaBase):
    """Payload de POST /streams/go-live."""

    platform: StreamPlatform
    title: str = Field(min_length=1, max_length=200)
    stream_url: str = Field(min_length=1, max_length=_URL_MAX, alias="streamUrl")
    embed_url: str | None = Field(default=None, max_length=_URL_MAX, alias="embedUrl")
    post_id: str | None = Field(default=None, alias="postId")

    @field_validator("embed_url")
    @classmethod
    def _default_embed(cls, value: str | None, info) -> str:
        # Si no mandan embedUrl, se deriva del streamUrl (mismo criterio que devplay-main).
        return value or info.data.get("stream_url", "")


class StreamOut(BetaBase):
    id: str
    user_id: str = Field(alias="userId")
    post_id: str | None = Field(default=None, alias="postId")
    platform: StreamPlatform
    stream_url: str = Field(alias="streamUrl")
    embed_url: str = Field(alias="embedUrl")
    title: str
    is_live: bool = Field(alias="isLive")
    started_at: datetime | None = Field(default=None, alias="startedAt")
    ended_at: datetime | None = Field(default=None, alias="endedAt")
    created_at: datetime = Field(alias="createdAt")


__all__ = [
    "BetaCreate",
    "BetaDownloadOut",
    "BetaOut",
    "BetaUpdate",
    "StreamGoLiveIn",
    "StreamOut",
]