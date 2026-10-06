from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.poll import Poll
from app.models.user import User
from app.schemas.poll import (
    PollCreate,
    PollOptionOut,
    PollOut,
    PollVoteIn,
    PollVoteResult,
)
from app.services import poll_service as svc
from app.services import post_service as post_svc
from app.utils.rate_limit import check_rate_limit

router = APIRouter(tags=["polls"])


# --- Helpers ---


def _to_out(poll: Poll, voted: list[str]) -> PollOut:
    """Construye la respuesta. `vote_count` viene ya contado en la columna."""
    out = PollOut.model_validate(poll)
    out.options = [
        PollOptionOut(
            id=o.id,
            text=o.text,
            position=o.position,
            vote_count=o.vote_count,
        )
        for o in sorted(poll.options, key=lambda o: o.position)
    ]
    out.total_votes = sum(o.vote_count for o in out.options)
    out.is_closed = svc.is_closed(poll)
    out.voted_option_ids = voted
    return out


def _load_one(db: Session, poll_id: str, user_id: str | None) -> PollOut:
    try:
        poll = svc.get_poll_or_404(db, poll_id)
    except svc.PollNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Poll not found") from None
    return _to_out(poll, svc.user_votes(db, poll_id, user_id))


# --- Crear encuesta dentro de un post ---


@router.post(
    "/posts/{post_id}/poll",
    response_model=PollOut,
    status_code=status.HTTP_201_CREATED,
    tags=["posts"],
    summary="Crea una encuesta en un post (solo autor)",
)
def create_poll_for_post(
    post_id: str,
    payload: PollCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Añade una encuesta a un post propio. Solo una encuesta por post."""
    try:
        post = post_svc.get_post_or_404(db, post_id)
    except post_svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None

    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the author of this post")

    try:
        poll = svc.create_poll(db, post, payload)
    except svc.PollAlreadyExistsError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This post already has a poll") from None

    return _to_out(poll, [])


@router.get(
    "/posts/{post_id}/poll",
    response_model=PollOut,
    tags=["posts"],
    summary="Ver la encuesta de un post",
)
def get_poll_of_post(
    post_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    poll = svc.get_poll_by_post(db, post_id)
    if poll is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This post has no poll")
    return _to_out(poll, svc.user_votes(db, poll.id, viewer.id if viewer else None))


# --- Listar / ver encuestas ---


@router.get("/polls", response_model=list[PollOut], summary="Lista las encuestas recientes")
def list_polls(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    polls, _total = svc.list_polls(db, skip=skip, limit=limit)
    ids = [p.id for p in polls]
    votes = svc.votes_bulk(db, ids, viewer.id if viewer else None)
    return [_to_out(p, votes.get(p.id, [])) for p in polls]


@router.get("/polls/{poll_id}", response_model=PollOut, summary="Ver una encuesta")
def get_poll(
    poll_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    return _load_one(db, poll_id, viewer.id if viewer else None)


# --- Votar ---


@router.post(
    "/polls/{poll_id}/vote",
    response_model=PollVoteResult,
    summary="Vota en una encuesta",
)
def vote_poll(
    poll_id: str,
    payload: PollVoteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Registra el voto. En encuestas de opción única, repetir voto cambia la opción."""
    poll = svc.get_poll_or_404(db, poll_id)

    check_rate_limit(f"poll:vote:{user.id}", limit=30, window_seconds=60)

    try:
        poll, created = svc.vote(db, poll, user, payload.option_ids)
    except svc.PollClosedError:
        raise HTTPException(status.HTTP_409_CONFLICT, "This poll is closed") from None
    except svc.DuplicateVoteError:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already voted in this poll") from None
    except svc.InvalidOptionError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from None

    return PollVoteResult(poll=_to_out(poll, payload.option_ids), created=created)