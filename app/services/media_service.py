"""Subida de archivos (avatar, portada y galería multimedia).

Los archivos se guardan en disco dentro de `uploads_dir` y se sirven desde
`/uploads`. Se valida el tipo MIME declarado, la extensión y el tamaño máximo
para no subir ejecutables ni archivos gigantes.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import Settings, get_settings

# Extensiones permitidas por tipo MIME.
_EXTENSIONS_BY_MIME: dict[str, set[str]] = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
    "video/mp4": {".mp4"},
    "video/webm": {".webm"},
}

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


@dataclass(frozen=True)
class UploadedFile:
    """Archivo ya guardado en disco."""

    url: str
    kind: str  # "image" | "video"
    filename: str
    size: int


class UploadError(ValueError):
    """Error de validación de un archivo subido."""


def uploads_root(settings: Settings | None = None) -> Path:
    settings = settings or get_settings()
    root = Path(settings.uploads_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _extension(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def validate_upload(file: UploadFile, settings: Settings | None = None) -> str:
    """Valida el archivo y devuelve su kind ("image" | "video").

    Lanza `UploadError` si el tipo, la extensión o el tamaño no son válidos.
    """
    settings = settings or get_settings()

    mime = (file.content_type or "").split(";")[0].strip().lower()
    allowed = set(settings.allowed_image_types) | set(settings.allowed_video_types)
    if mime not in allowed:
        raise UploadError(
            "Formato no permitido. Usa una imagen (JPG, PNG, WEBP, GIF) "
            "o un video (MP4, WEBM)."
        )

    # La extensión debe coincidir con el tipo declarado: evita subir un
    # ".exe" que se declare como imagen.
    ext = _extension(file.filename or "")
    valid_exts = _EXTENSIONS_BY_MIME.get(mime, set())
    if not ext or ext not in valid_exts:
        allowed_exts = ", ".join(sorted(valid_exts))
        raise UploadError(f"Extensión inválida para {mime}. Se permite: {allowed_exts}.")

    return "video" if mime.startswith("video/") else "image"


def save_upload(
    file: UploadFile,
    user_id: str,
    settings: Settings | None = None,
) -> UploadedFile:
    """Guarda el archivo y devuelve su URL pública."""
    settings = settings or get_settings()
    kind = validate_upload(file, settings)

    ext = _extension(file.filename or "")
    # Nombre seguro y único: nunca se usa el nombre original tal cual.
    stem = _SAFE_NAME.sub("-", Path(file.filename or "archivo").stem)[:40] or "archivo"
    name = f"{user_id}_{stem}_{uuid.uuid4().hex[:8]}{ext}"

    root = uploads_root(settings)
    target = root / name

    size = 0
    try:
        with target.open("wb") as out:
            while True:
                chunk = file.file.read(64 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    out.close()
                    target.unlink(missing_ok=True)
                    raise UploadError(
                        f"El archivo supera el máximo de "
                        f"{settings.max_upload_bytes // (1024 * 1024)} MB."
                    )
                out.write(chunk)
    except UploadError:
        raise
    except OSError as exc:
        target.unlink(missing_ok=True)
        raise UploadError(f"No se pudo guardar el archivo: {exc}") from exc

    if size == 0:
        target.unlink(missing_ok=True)
        raise UploadError("El archivo está vacío.")

    base = settings.public_base_url.rstrip("/")
    return UploadedFile(
        url=f"{base}/uploads/{name}",
        kind=kind,
        filename=name,
        size=size,
    )


def delete_upload(url: str | None, settings: Settings | None = None) -> bool:
    """Borra un archivo subido previamente (por su URL). Devuelve True si lo borró."""
    if not url:
        return False
    settings = settings or get_settings()
    prefix = f"{settings.public_base_url.rstrip('/')}/uploads/"
    if not url.startswith(prefix):
        return False
    name = url[len(prefix) :]
    if "/" in name or "\\" in name or ".." in name:
        return False
    target = uploads_root(settings) / name
    if not target.is_file():
        return False
    try:
        target.unlink()
        return True
    except OSError:
        return False


def http_error(exc: UploadError) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
