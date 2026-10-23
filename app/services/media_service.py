"""Subida, borrado y listado de archivos del usuario (avatar, portada, galería).

El cliente Flutter hace:

    POST   /users/me/media          (multipart, campo "file")
    DELETE /users/me/media?url=...
    GET    /users/{id}/media

Los archivos se guardan en `MEDIA_DIR` y se sirven como archivos estáticos en
`MEDIA_URL_PREFIX` (`/media`). La respuesta trae la URL absoluta para que el
cliente pueda usarla tal cual en un `<img>` o `<video>`.
"""

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.media import UserMedia
from app.models.user import User
from app.schemas.user import MediaUploadOut, ProfileMediaOut

logger = logging.getLogger("devplay.media")

IMAGE_EXTENSIONS = ("jpg", "jpeg", "png", "webp", "gif")
VIDEO_EXTENSIONS = ("mp4", "webm")
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS + VIDEO_EXTENSIONS


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _kind_for(extension: str) -> str:
    return "video" if extension in VIDEO_EXTENSIONS else "image"


def _media_root() -> Path:
    root = Path(get_settings().media_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _public_url(request: Request, relative_path: str) -> str:
    """URL absoluta del archivo servido por el StaticFiles de /media."""
    prefix = get_settings().media_url_prefix.rstrip("/")
    try:
        return str(request.url_for("media", path=relative_path))
    except Exception:  # pragma: no cover - solo si el mount no existe
        return f"{str(request.base_url).rstrip('/')}{prefix}/{relative_path}"


def save_upload(db: Session, user: User, request: Request, file: UploadFile) -> MediaUploadOut:
    """Guarda el archivo en disco y lo registra en `UserMedia`."""
    settings = get_settings()
    extension = _extension(file.filename or "")
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Formato no permitido. Se aceptan: " + ", ".join(ALLOWED_EXTENSIONS),
        )

    max_bytes = settings.max_upload_mb * 1024 * 1024
    # Lectura síncrona: el endpoint es `def` (FastAPI lo ejecuta en un threadpool).
    payload = file.file.read()
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo está vacío")
    if len(payload) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"El archivo supera el máximo de {settings.max_upload_mb} MB",
        )
    relative = f"{user.id}/{uuid.uuid4().hex}.{extension}"
    destination = _media_root() / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)

    url = _public_url(request, relative)
    media = UserMedia(
        user_id=user.id,
        url=url,
        kind=_kind_for(extension),
        filename=file.filename or destination.name,
        size=len(payload),
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return MediaUploadOut(
        url=media.url,
        kind=media.kind,
        filename=media.filename,
        size=media.size,
    )


def delete_upload(db: Session, user: User, url: str) -> bool:
    """Borra el archivo (y su registro). Devuelve False si no era suyo."""
    media = db.scalar(select(UserMedia).where(UserMedia.url == url, UserMedia.user_id == user.id))
    if media is None:
        return False

    prefix = get_settings().media_url_prefix.rstrip("/")
    # Solo se borran archivos servidos por la API (nada de rutas arbitrarias).
    if prefix in media.url:
        relative = media.url.split(f"{prefix}/", 1)[-1]
        target = (_media_root() / relative).resolve()
        root = _media_root()
        if target.is_file() and str(target).startswith(str(root)):
            target.unlink(missing_ok=True)

    db.delete(media)
    db.commit()
    return True


def list_media(db: Session, user_id: str) -> list[ProfileMediaOut]:
    """Medios subidos por un usuario, del más nuevo al más viejo."""
    rows = db.scalars(
        select(UserMedia)
        .where(UserMedia.user_id == user_id)
        .order_by(UserMedia.created_at.desc())
        .limit(100)
    ).all()
    return [
        ProfileMediaOut(
            url=row.url,
            kind=row.kind,
            post_id=row.post_id,
            created_at=row.created_at,
        )
        for row in rows
    ]
