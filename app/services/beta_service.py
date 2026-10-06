from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.beta import Beta
from app.models.content import Post
from app.models.stream import Stream
from app.models.user import User
from app.schemas.beta import BetaCreate, BetaUpdate, StreamGoLiveIn
from app.utils.json_fields import dumps_json


class BetaNotFoundError(LookupError):
    pass


class NotBetaAuthorError(PermissionError):
    pass


class InvalidDownloadError(ValueError):
    pass


class StreamNotFoundError(LookupError):
    pass


class AlreadyLiveError(ValueError):
    pass


class NotLiveError(ValueError):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _dump(value) -> str | None:
    """Serializa a JSON-string, o None si la lista va vacía (columnas nullable)."""
    return dumps_json(value) if value else None


# ---------------------------------------------------------------- Betas


def get_beta_or_404(db: Session, beta_id: str) -> Beta:
    beta = db.scalar(select(Beta).where(Beta.id == beta_id))
    if beta is None:
        raise BetaNotFoundError()
    return beta


def create_beta(db: Session, author: User, payload: BetaCreate) -> Beta:
    """Crea el post de tipo BETA y su ficha 1:1."""
    post = Post(
        author_id=author.id,
        type="BETA",
        content=payload.description,
        media_urls=dumps_json(
            [{"url": payload.cover_image, "kind": "image"}] if payload.cover_image else []
        )
        or None,
    )
    db.add(post)
    db.flush()  # necesitamos post.id para la ficha

    beta = Beta(
        post_id=post.id,
        title=payload.title,
        description=payload.description,
        download_type=str(payload.download_type),
        file_url=payload.file_url,
        file_size=payload.file_size,
        file_name=payload.file_name,
        external_url=payload.external_url,
        beta_status=str(payload.beta_status),
        genre=payload.genre,
        version=payload.version,
        platforms=_dump(payload.platforms),
        tags=_dump(payload.tags),
        requirements=payload.requirements,
        changelog=payload.changelog,
        install_instructions=payload.install_instructions,
        cover_image=payload.cover_image,
        screenshots=_dump(payload.screenshots),
        external_platform=payload.external_platform,
        downloads=0,
    )
    db.add(beta)
    db.commit()
    db.refresh(beta)
    return beta


def list_betas(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    beta_status: str | None = None,
    author_id: str | None = None,
) -> tuple[list[Beta], int]:
    stmt = select(Beta)
    count_stmt = select(func.count()).select_from(Beta)

    if beta_status is not None:
        stmt = stmt.where(Beta.beta_status == beta_status)
        count_stmt = count_stmt.where(Beta.beta_status == beta_status)
    if author_id is not None:
        stmt = stmt.where(Beta.post.has(Post.author_id == author_id))
        count_stmt = count_stmt.where(Beta.post.has(Post.author_id == author_id))

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Beta.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all()), total


def update_beta(db: Session, beta: Beta, user: User, payload: BetaUpdate) -> Beta:
    """Aplica solo los campos enviados. Solo el autor del post puede editar."""
    post = db.scalar(select(Post).where(Post.id == beta.post_id))
    if post is None or post.author_id != user.id:
        raise NotBetaAuthorError()

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in ("platforms", "tags", "screenshots"):
            setattr(beta, field, _dump(value))
        else:
            setattr(beta, field, str(value) if value is not None else None)

    # El post lleva el contenido y la portada: se mantiene en sincronía.
    if "description" in data and post.content != data["description"]:
        post.content = data["description"]
        db.add(post)
    if "cover_image" in data:
        post.media_urls = (
            dumps_json([{"url": data["cover_image"], "kind": "image"}])
            if data["cover_image"]
            else None
        )
        db.add(post)

    db.add(beta)
    db.commit()
    db.refresh(beta)
    return beta


def register_download(db: Session, beta: Beta) -> Beta:
    """Suma 1 al contador de descargas."""
    beta.downloads += 1
    db.add(beta)
    db.commit()
    db.refresh(beta)
    return beta


def resolve_download(beta: Beta) -> tuple[str, str | None, int | None]:
    """Devuelve (url, file_name, file_size) según el tipo de descarga."""
    if beta.download_type == "DIRECT":
        if not beta.file_url:
            raise InvalidDownloadError("This beta has no file to download")
        return beta.file_url, beta.file_name, beta.file_size
    if not beta.external_url:
        raise InvalidDownloadError("This beta has no external link")
    return beta.external_url, None, None


# ---------------------------------------------------------------- Streams


def get_stream_or_404(db: Session, stream_id: str) -> Stream:
    stream = db.scalar(select(Stream).where(Stream.id == stream_id))
    if stream is None:
        raise StreamNotFoundError()
    return stream


def get_live_stream_of(db: Session, user_id: str) -> Stream | None:
    return db.scalar(
        select(Stream).where(Stream.user_id == user_id, Stream.is_live.is_(True))
    )


def list_streams(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    live_only: bool = False,
    platform: str | None = None,
) -> tuple[list[Stream], int]:
    stmt = select(Stream)
    count_stmt = select(func.count()).select_from(Stream)

    if live_only:
        stmt = stmt.where(Stream.is_live.is_(True))
        count_stmt = count_stmt.where(Stream.is_live.is_(True))
    if platform is not None:
        stmt = stmt.where(Stream.platform == platform)
        count_stmt = count_stmt.where(Stream.platform == platform)

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Stream.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all()), total


def go_live(db: Session, user: User, payload: StreamGoLiveIn) -> Stream:
    """Marca el directo como en vivo. Un usuario solo puede tener uno activo."""
    if get_live_stream_of(db, user.id) is not None:
        raise AlreadyLiveError()

    stream = Stream(
        user_id=user.id,
        post_id=payload.post_id,
        platform=str(payload.platform),
        stream_url=payload.stream_url,
        embed_url=payload.embed_url or payload.stream_url,
        title=payload.title,
        is_live=True,
        started_at=_utcnow(),
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


def go_offline(db: Session, user: User) -> Stream:
    """Termina el directo activo del usuario."""
    stream = get_live_stream_of(db, user.id)
    if stream is None:
        raise NotLiveError()
    stream.is_live = False
    stream.ended_at = _utcnow()
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


__all__ = [
    "AlreadyLiveError",
    "BetaNotFoundError",
    "InvalidDownloadError",
    "NotBetaAuthorError",
    "NotLiveError",
    "StreamNotFoundError",
    "create_beta",
    "get_beta_or_404",
    "get_live_stream_of",
    "get_stream_or_404",
    "go_live",
    "go_offline",
    "list_betas",
    "list_streams",
    "register_download",
    "resolve_download",
    "update_beta",
]