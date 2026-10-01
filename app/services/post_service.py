from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.content import Bookmark, Comment, Like, Post
from app.models.user import User
from app.schemas.content import CommentCreate, PostCreate, PostUpdate
from app.utils.json_fields import dumps_json


class PostNotFoundError(LookupError):
    pass


class NotPostAuthorError(PermissionError):
    pass


class AlreadyRepostedError(ValueError):
    pass


# --- Lectura ---


def get_post_or_404(db: Session, post_id: str) -> Post:
    post = db.scalar(select(Post).where(Post.id == post_id))
    if post is None:
        raise PostNotFoundError()
    return post


def list_posts(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    author_id: str | None = None,
    viewer_id: str | None = None,
) -> tuple[list[Post], int]:
    """Feed paginado, del más nuevo al más viejo.

    Los reposts se excluyen del feed general, pero SÍ aparecen en el perfil de
    quien los hizo (filtrando por `author_id`), igual que en devplay-main.
    """
    stmt = select(Post)
    count_stmt = select(func.count()).select_from(Post)

    if author_id is not None:
        stmt = stmt.where(Post.author_id == author_id)
        count_stmt = count_stmt.where(Post.author_id == author_id)
    else:
        stmt = stmt.where(Post.repost_of_id.is_(None))
        count_stmt = count_stmt.where(Post.repost_of_id.is_(None))

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all()), total


def list_comments(db: Session, post_id: str) -> list[Comment]:
    stmt = (
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    return list(db.scalars(stmt).all())


# --- Escritura ---


def create_post(db: Session, author: User, payload: PostCreate) -> Post:
    post = Post(
        author_id=author.id,
        type=str(payload.type),
        content=payload.content,
        media_urls=dumps_json([m.model_dump(mode="json") for m in payload.media]) or None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def update_post(db: Session, post: Post, author: User, payload: PostUpdate) -> Post:
    if post.author_id != author.id:
        raise NotPostAuthorError()

    data = payload.model_dump(exclude_unset=True)
    if "content" in data:
        post.content = data["content"]
    if "media" in data:
        media = data["media"] or []
        post.media_urls = dumps_json(media) or None

    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def delete_post(db: Session, post: Post, author: User) -> None:
    if post.author_id != author.id:
        raise NotPostAuthorError()

    # `Poll.post`, `Stream.post` y `Beta.post` no tienen `passive_deletes=True`, así que el
    # ORM intentaría poner `postId = NULL` (ON DELETE SET NULL) y chocar con el NOT NULL
    # antes de que la BD aplique su CASCADE. Se borra con un DELETE a nivel de tabla: la BD
    # resuelve el CASCADE de Comment/Like/Bookmark/Poll/Stream/Beta por su cuenta.
    db.execute(delete(Post).where(Post.id == post.id))
    db.commit()


def add_comment(db: Session, post: Post, author: User, payload: CommentCreate) -> Comment:
    comment = Comment(post_id=post.id, user_id=author.id, content=payload.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment: Comment, user: User) -> None:
    """Se permite borrar el propio comentario o cualquier post propio (moderación)."""
    if comment.user_id != user.id:
        post = db.scalar(select(Post).where(Post.id == comment.post_id))
        if post is None or post.author_id != user.id:
            raise NotPostAuthorError()
    db.delete(comment)
    db.commit()


def create_repost(db: Session, post: Post, author: User) -> Post:
    """Crea un post que apunta al original. Solo uno por usuario y post."""
    existing = db.scalar(
        select(Post).where(Post.repost_of_id == post.id, Post.author_id == author.id)
    )
    if existing is not None:
        raise AlreadyRepostedError()

    repost = Post(author_id=author.id, type=post.type, content=None, repost_of_id=post.id)
    db.add(repost)
    db.commit()
    db.refresh(repost)
    return repost


# --- Likes / bookmarks (toggle) ---


def toggle_like(db: Session, post: Post, user: User) -> bool:
    """Devuelve True si quedó con like, False si se quitó."""
    existing = db.scalar(
        select(Like).where(Like.post_id == post.id, Like.user_id == user.id)
    )
    if existing is not None:
        db.delete(existing)
        active = False
    else:
        db.add(Like(post_id=post.id, user_id=user.id))
        active = True
    db.commit()
    return active


def toggle_bookmark(db: Session, post: Post, user: User) -> bool:
    existing = db.scalar(
        select(Bookmark).where(Bookmark.post_id == post.id, Bookmark.user_id == user.id)
    )
    if existing is not None:
        db.delete(existing)
        active = False
    else:
        db.add(Bookmark(post_id=post.id, user_id=user.id))
        active = True
    db.commit()
    return active


# --- Conteos para el schema de salida ---


def count_for(db: Session, model, post_id: str) -> int:
    stmt = select(func.count()).select_from(model).where(model.post_id == post_id)
    return db.scalar(stmt) or 0


def counts_bulk(
    db: Session, model, post_ids: list[str]
) -> dict[str, int]:
    """Conteos de varios posts en una sola query (evita N+1)."""
    if not post_ids:
        return {}
    stmt = (
        select(model.post_id, func.count())
        .where(model.post_id.in_(post_ids))
        .group_by(model.post_id)
    )
    return dict(db.execute(stmt).all())


def marked_bulk(
    db: Session, model, post_ids: list[str], user_id: str
) -> set[str]:
    """IDs de posts que el usuario ya marcó (like/bookmark), en una sola query."""
    if not post_ids:
        return set()
    stmt = select(model.post_id).where(
        model.post_id.in_(post_ids), model.user_id == user_id
    )
    return set(db.scalars(stmt).all())


__all__ = [
    "AlreadyRepostedError",
    "NotPostAuthorError",
    "PostNotFoundError",
    "add_comment",
    "count_for",
    "counts_bulk",
    "create_post",
    "create_repost",
    "delete_comment",
    "delete_post",
    "get_post_or_404",
    "list_comments",
    "list_posts",
    "marked_bulk",
    "toggle_bookmark",
    "toggle_like",
    "update_post",
]