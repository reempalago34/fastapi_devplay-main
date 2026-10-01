from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.content import Post
from app.models.poll import Poll, PollOption, PollVote
from app.models.user import User
from app.schemas.poll import PollCreate


class PollAlreadyExistsError(ValueError):
    pass


class PollNotFoundError(LookupError):
    pass


class PollClosedError(ValueError):
    pass


class InvalidOptionError(ValueError):
    pass


class DuplicateVoteError(ValueError):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC)


def is_closed(poll: Poll) -> bool:
    """Una encuesta está cerrada si tiene `closesAt` y ya pasó."""
    if poll.closes_at is None:
        return False
    closes_at = poll.closes_at
    if closes_at.tzinfo is None:
        closes_at = closes_at.replace(tzinfo=UTC)
    return closes_at <= _utcnow()


def get_poll_or_404(db: Session, poll_id: str) -> Poll:
    poll = db.scalar(select(Poll).where(Poll.id == poll_id))
    if poll is None:
        raise PollNotFoundError()
    return poll


def get_poll_by_post(db: Session, post_id: str) -> Poll | None:
    return db.scalar(select(Poll).where(Poll.post_id == post_id))


def create_poll(db: Session, post: Post, payload: PollCreate) -> Poll:
    """Crea la encuesta en un post. Solo puede haber una por post."""
    if get_poll_by_post(db, post.id) is not None:
        raise PollAlreadyExistsError()

    poll = Poll(
        post_id=post.id,
        question=payload.question,
        allow_multiple=payload.allow_multiple,
        closes_at=payload.closes_at,
    )
    db.add(poll)
    db.flush()  # necesitamos poll.id antes de crear las opciones

    for position, option in enumerate(payload.options):
        db.add(
            PollOption(poll_id=poll.id, text=option.text, position=position, vote_count=0)
        )

    db.commit()
    db.refresh(poll)
    return poll


def list_polls(db: Session, skip: int = 0, limit: int = 20) -> tuple[list[Poll], int]:
    """Lista las encuestas recientes con sus opciones."""
    total = db.scalar(select(func.count()).select_from(Poll)) or 0
    stmt = select(Poll).order_by(Poll.created_at.desc()).offset(skip).limit(limit)
    polls = list(db.scalars(stmt).all())
    # Carga las opciones de todas las encuestas en una query (evita N+1).
    if polls:
        poll_ids = [p.id for p in polls]
        options = db.scalars(
            select(PollOption)
            .where(PollOption.poll_id.in_(poll_ids))
            .order_by(PollOption.position)
        ).all()
        by_poll: dict[str, list[PollOption]] = {}
        for option in options:
            by_poll.setdefault(option.poll_id, []).append(option)
        for poll in polls:
            poll.options = by_poll.get(poll.id, [])
    return polls, total


def vote(
    db: Session, poll: Poll, user: User, option_ids: list[str]
) -> tuple[Poll, bool]:
    """Registra el voto de un usuario.

    Devuelve (poll, created): `created=False` si el voto anterior fue reemplazado.
    Reglas: la encuesta debe estar abierta, las opciones deben pertenecer a la
    encuesta, y en opción única no se puede cambiar el voto.
    """
    if is_closed(poll):
        raise PollClosedError()

    unique_ids = list(dict.fromkeys(option_ids))
    if not poll.allow_multiple and len(unique_ids) > 1:
        raise InvalidOptionError("This poll only allows one option")

    options = db.scalars(
        select(PollOption).where(
            PollOption.poll_id == poll.id, PollOption.id.in_(unique_ids)
        )
    ).all()
    if len(options) != len(unique_ids):
        raise InvalidOptionError("Some options do not belong to this poll")

    existing = db.scalars(
        select(PollVote).where(
            PollVote.poll_id == poll.id, PollVote.user_id == user.id
        )
    ).all()
    current = {v.option_id for v in existing}
    already = current == set(unique_ids)

    if existing and not already and not poll.allow_multiple:
        raise DuplicateVoteError("You already voted in this poll")

    if already:
        # Voto idéntico al que ya tenía: no se toca nada (idempotente).
        return poll, False

    # Libera los votos anteriores y ajusta los contadores de sus opciones.
    released = current - set(unique_ids)
    if existing:
        db.execute(
            delete(PollVote).where(
                PollVote.poll_id == poll.id, PollVote.user_id == user.id
            )
        )
        for option_id in released:
            _adjust_count(db, option_id, -1)

    for option in options:
        db.add(PollVote(poll_id=poll.id, option_id=option.id, user_id=user.id))
        _adjust_count(db, option.id, +1)

    db.commit()
    # Recarga para que `_to_out` lea los contadores ya actualizados.
    db.expire(poll, ["options"])
    db.refresh(poll)
    # `created` es False si el usuario ya tenía voto (lo acaba de reemplazar).
    return poll, not existing


def _adjust_count(db: Session, option_id: str, delta: int) -> None:
    """Suma o resta al contador de una opción. La columna es `voteCount` (camelCase)."""
    db.execute(
        PollOption.__table__.update()
        .where(PollOption.__table__.c.id == option_id)
        .values(voteCount=PollOption.__table__.c.voteCount + delta)
    )


def user_votes(db: Session, poll_id: str, user_id: str | None) -> list[str]:
    if user_id is None:
        return []
    stmt = select(PollVote.option_id).where(
        PollVote.poll_id == poll_id, PollVote.user_id == user_id
    )
    return list(db.scalars(stmt).all())


def votes_bulk(db: Session, poll_ids: list[str], user_id: str | None) -> dict[str, list[str]]:
    """Votos del usuario en varias encuestas, en una sola query."""
    if not poll_ids or user_id is None:
        return {}
    stmt = select(PollVote.poll_id, PollVote.option_id).where(
        PollVote.poll_id.in_(poll_ids), PollVote.user_id == user_id
    )
    out: dict[str, list[str]] = {}
    for poll_id, option_id in db.execute(stmt).all():
        out.setdefault(poll_id, []).append(option_id)
    return out


__all__ = [
    "DuplicateVoteError",
    "InvalidOptionError",
    "PollAlreadyExistsError",
    "PollClosedError",
    "PollNotFoundError",
    "create_poll",
    "get_poll_by_post",
    "get_poll_or_404",
    "is_closed",
    "list_polls",
    "user_votes",
    "vote",
    "votes_bulk",
]