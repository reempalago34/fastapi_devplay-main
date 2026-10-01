from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.content import Bookmark, Comment, Like, Post
from app.models.user import User
from app.schemas.content import (
    AuthorSummary,
    CommentCreate,
    CommentOut,
    PostCreate,
    PostListOut,
    PostOut,
    PostUpdate,
    ToggleOut,
)
from app.services import post_service as svc
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/posts", tags=["posts"])


# --- Helpers ---


def _author_of(obj) -> AuthorSummary | None:
    user = getattr(obj, "author", None) or getattr(obj, "user", None)
    if user is None:
        return None
    return AuthorSummary(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        avatar=user.avatar,
    )


def _to_out(
    post: Post,
    likes_count: int,
    comments_count: int,
    liked: bool,
    bookmarked: bool,
) -> PostOut:
    """Construye la respuesta. `media` se parsea del JSON-string de la columna."""
    out = PostOut.model_validate(post)
    out.author = _author_of(post)
    out.likes_count = likes_count
    out.comments_count = comments_count
    out.liked_by_me = liked
    out.bookmarked_by_me = bookmarked
    return out


def _serialize_many(
    db: Session, posts: list[Post], viewer_id: str | None
) -> list[PostOut]:
    """Serializa una lista evitando N+1: 4 queries en total, no 4 por post."""
    if not posts:
        return []

    ids = [p.id for p in posts]
    likes = svc.counts_bulk(db, Like, ids)
    comments = svc.counts_bulk(db, Comment, ids)
    liked = svc.marked_bulk(db, Like, ids, viewer_id) if viewer_id else set()
    marked = svc.marked_bulk(db, Bookmark, ids, viewer_id) if viewer_id else set()

    return [
        _to_out(p, likes.get(p.id, 0), comments.get(p.id, 0), p.id in liked, p.id in marked)
        for p in posts
    ]


def _get_post_or_404(db: Session, post_id: str) -> Post:
    """Traduce la excepción del service a un 401-free 404 limpio."""
    try:
        return svc.get_post_or_404(db, post_id)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None


def _load_one(db: Session, post_id: str, viewer_id: str | None) -> PostOut:
    post = _get_post_or_404(db, post_id)
    results = _serialize_many(db, [post], viewer_id)
    return results[0]


# --- Feed ---


@router.get("", response_model=PostListOut, summary="Lista el feed de posts")
def list_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    author_id: str | None = Query(None, description="Filtra por autor"),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    """Feed paginado del más nuevo al más viejo. Los reposts no aparecen aquí."""
    posts, total = svc.list_posts(
        db, skip=skip, limit=limit, author_id=author_id, viewer_id=viewer.id if viewer else None
    )
    return PostListOut(
        items=_serialize_many(db, posts, viewer.id if viewer else None),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=PostOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un post",
)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Crea una publicación. Requiere contenido o al menos un medio."""
    check_rate_limit(f"post:create:{user.id}", limit=20, window_seconds=60)
    post = svc.create_post(db, user, payload)
    return _load_one(db, post.id, user.id)


@router.get("/{post_id}", response_model=PostOut, summary="Ver un post")
def get_post(
    post_id: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    return _load_one(db, post_id, viewer.id if viewer else None)


@router.patch("/{post_id}", response_model=PostOut, summary="Edita un post (solo autor)")
def update_post(
    post_id: str,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        post = svc.get_post_or_404(db, post_id)
        svc.update_post(db, post, user, payload)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None
    except svc.NotPostAuthorError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the author of this post") from None
    return _load_one(db, post_id, user.id)


@router.delete(
    "/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un post (solo autor)",
)
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        post = svc.get_post_or_404(db, post_id)
        svc.delete_post(db, post, user)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None
    except svc.NotPostAuthorError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the author of this post") from None


# --- Comentarios ---


@router.get("/{post_id}/comments", response_model=list[CommentOut], summary="Lista comentarios")
def list_comments(
    post_id: str,
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    try:
        svc.get_post_or_404(db, post_id)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None

    return [
        CommentOut(
            id=c.id,
            post_id=c.post_id,
            content=c.content,
            author=_author_of(c),
            created_at=c.created_at,
        )
        for c in svc.list_comments(db, post_id)
    ]


@router.post(
    "/{post_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Comenta un post",
)
def add_comment(
    post_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_rate_limit(f"comment:create:{user.id}", limit=30, window_seconds=60)
    try:
        post = svc.get_post_or_404(db, post_id)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None

    comment = svc.add_comment(db, post, user, payload)
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        content=comment.content,
        author=_author_of(comment),
        created_at=comment.created_at,
    )


@router.delete(
    "/{post_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Borra un comentario",
)
def delete_comment(
    post_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.get(Comment, comment_id)
    if comment is None or comment.post_id != post_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    try:
        svc.delete_comment(db, comment, user)
    except svc.NotPostAuthorError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot delete this comment") from None


# --- Likes ---


@router.post("/{post_id}/likes", response_model=ToggleOut, summary="Da like (toggle)")
def toggle_like(
    post_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        post = svc.get_post_or_404(db, post_id)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None

    active = svc.toggle_like(db, post, user)
    return ToggleOut(active=active, count=svc.count_for(db, Like, post_id))


# --- Bookmarks ---


@router.post("/{post_id}/bookmarks", response_model=ToggleOut, summary="Guarda un post (toggle)")
def toggle_bookmark(
    post_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        post = svc.get_post_or_404(db, post_id)
    except svc.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found") from None

    active = svc.toggle_bookmark(db, post, user)
    return ToggleOut(active=active, count=svc.count_for(db, Bookmark, post_id))


# --- Repost ---


@router.post(
    "/{post_id}/repost",
    response_model=PostOut,
    status_code=status.HTTP_201_CREATED,
    summary="Repostea un post",
)
def repost(
    post_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Crea un repost. Solo se permite uno por usuario y post.

    Devuelve el post **original** (con el contenido), no el repost vacío: es lo que
    espera el frontend para pintar la tarjeta. El repost queda en `repost_of_id`
    del registro creado y no aparece en el feed.
    """
    post = _get_post_or_404(db, post_id)

    try:
        svc.create_repost(db, post, user)
    except svc.AlreadyRepostedError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already reposted this post") from None

    return _load_one(db, post_id, user.id)