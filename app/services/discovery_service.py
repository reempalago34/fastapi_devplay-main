"""Búsqueda y agregación de Discover (M4).

Puerto de devplay-main/src/app/api/devplay/{search,discover}/route.ts:
mismas secciones, mismos límites, pero en SQL sobre Postgres en vez de Prisma.
"""

import json

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.beta import Beta
from app.models.content import Comment, Like, Post
from app.models.social import Block, Follow
from app.models.user import User
from app.schemas.content import AuthorSummary
from app.schemas.discovery import BetaCard, TagCount, UserSearchItem
from app.services import post_service as content


def blocked_ids(db: Session, viewer_id: str | None) -> set[str]:
    """IDs con los que el viewer tiene un bloqueo (en cualquier dirección)."""
    if viewer_id is None:
        return set()
    rows = db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == viewer_id, Block.blocked_id == viewer_id)
        )
    ).all()
    return {user_id for pair in rows for user_id in pair}


def following_ids(db: Session, viewer_id: str | None) -> set[str]:
    if viewer_id is None:
        return set()
    stmt = select(Follow.followee_id).where(Follow.follower_id == viewer_id)
    return set(db.scalars(stmt).all())


def _author_not_in(ids: set[str]):
    """Condición SQL que se omite por completo cuando no hay nada que excluir
    (un `NOT IN ()` vacío no compila a algo claro en SQLAlchemy)."""
    return Post.author_id.notin_(ids) if ids else None


def _user_counts(db: Session, user_ids: list[str]) -> tuple[dict[str, int], dict[str, int]]:
    """Seguidores y posts de varios usuarios en dos queries (sin N+1)."""
    if not user_ids:
        return {}, {}
    followers = dict(
        db.execute(
            select(Follow.followee_id, func.count())
            .where(Follow.followee_id.in_(user_ids))
            .group_by(Follow.followee_id)
        ).all()
    )
    posts = dict(
        db.execute(
            select(Post.author_id, func.count())
            .where(Post.author_id.in_(user_ids))
            .group_by(Post.author_id)
        ).all()
    )
    return followers, posts


def _to_search_item(user: User, followers: int, posts: int) -> UserSearchItem:
    return UserSearchItem(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        avatar=user.avatar,
        role=user.role,
        followers_count=followers,
        posts_count=posts,
    )


# --- GET /search ---


def search_users(
    db: Session, q: str, viewer_id: str | None, limit: int = 10
) -> list[UserSearchItem]:
    """No-invitados cuyo username, nombre o bio contienen `q` (sin distinguir mayúsculas)."""
    pattern = f"%{q}%"
    stmt = select(User).where(
        User.is_guest.is_(False),
        or_(
            User.username.ilike(pattern),
            User.full_name.ilike(pattern),
            User.bio.ilike(pattern),
        ),
    )
    excluded = blocked_ids(db, viewer_id)
    if excluded:
        stmt = stmt.where(User.id.notin_(excluded))
    users = list(db.scalars(stmt.order_by(User.created_at.desc()).limit(limit)).all())

    followers, posts = _user_counts(db, [u.id for u in users])
    return [_to_search_item(u, followers.get(u.id, 0), posts.get(u.id, 0)) for u in users]


def search_posts(db: Session, q: str, viewer_id: str | None, limit: int = 15) -> list[Post]:
    """Posts cuyo contenido o cuya beta (título/descripción) contienen `q`."""
    pattern = f"%{q}%"
    stmt = select(Post).outerjoin(Beta, Beta.post_id == Post.id).where(
        or_(
            Post.content.ilike(pattern),
            Beta.title.ilike(pattern),
            Beta.description.ilike(pattern),
        )
    )
    excluded = blocked_ids(db, viewer_id)
    condition = _author_not_in(excluded)
    if condition is not None:
        stmt = stmt.where(condition)
    return list(db.scalars(stmt.order_by(Post.created_at.desc()).limit(limit)).all())


# --- GET /discover ---


def trending_posts(db: Session, viewer_id: str | None, limit: int = 8) -> list[Post]:
    """Los 30 posts recientes con mejor puntaje de enganche
    (likes + comentarios*2 + reposts*3), quedándose con los `limit` mejores."""
    stmt = select(Post).where(
        Post.type.in_(["POST", "BETA"]),
        Post.repost_of_id.is_(None),
    )
    excluded = blocked_ids(db, viewer_id)
    condition = _author_not_in(excluded)
    if condition is not None:
        stmt = stmt.where(condition)
    candidates = list(db.scalars(stmt.order_by(Post.created_at.desc()).limit(30)).all())

    ids = [p.id for p in candidates]
    likes = content.counts_bulk(db, Like, ids)
    comments = content.counts_bulk(db, Comment, ids)
    reposts = dict(
        db.execute(
            select(Post.repost_of_id, func.count())
            .where(Post.repost_of_id.in_(ids))
            .group_by(Post.repost_of_id)
        ).all()
    )

    scored = sorted(
        candidates,
        key=lambda p: likes.get(p.id, 0) + comments.get(p.id, 0) * 2 + reposts.get(p.id, 0) * 3,
        reverse=True,
    )
    return scored[:limit]


def recommended_users(db: Session, viewer_id: str | None, limit: int = 6) -> list[UserSearchItem]:
    """Devs que no sigues y no estás bloqueando (ni te bloquearon a ti)."""
    excluded = blocked_ids(db, viewer_id) | following_ids(db, viewer_id)
    if viewer_id:
        excluded.add(viewer_id)

    stmt = select(User).where(User.is_guest.is_(False))
    if excluded:
        stmt = stmt.where(User.id.notin_(excluded))
    users = list(db.scalars(stmt.order_by(User.created_at.desc()).limit(limit)).all())

    followers, posts = _user_counts(db, [u.id for u in users])
    return [_to_search_item(u, followers.get(u.id, 0), posts.get(u.id, 0)) for u in users]


def popular_betas(db: Session, viewer_id: str | None, limit: int = 6) -> list[BetaCard]:
    """Betas con más descargas primero."""
    stmt = select(Beta).join(Post, Beta.post_id == Post.id)
    excluded = blocked_ids(db, viewer_id)
    condition = _author_not_in(excluded)
    if condition is not None:
        stmt = stmt.where(condition)
    betas = list(db.scalars(stmt.order_by(Beta.downloads.desc()).limit(limit)).all())

    cards: list[BetaCard] = []
    for beta in betas:
        post = beta.post
        likes = content.counts_bulk(db, Like, [post.id]).get(post.id, 0) if post else 0
        author = post.author if post else None
        cards.append(
            BetaCard(
                id=beta.id,
                post_id=beta.post_id,
                title=beta.title,
                description=beta.description,
                cover_image=beta.cover_image,
                downloads=beta.downloads,
                genre=beta.genre,
                version=beta.version,
                likes_count=likes,
                author=_author_summary(author) if author else None,
            )
        )
    return cards


def _author_summary(user: User) -> AuthorSummary:
    return AuthorSummary(
        id=user.id, username=user.username, full_name=user.full_name, avatar=user.avatar
    )


def popular_tags(db: Session, limit: int = 10) -> list[TagCount]:
    """Tags de perfiles y de betas, ordenados por cuánta gente los usa."""
    counts: dict[str, int] = {}

    for (raw,) in db.execute(select(User.tags).where(User.tags.is_not(None)).limit(100)):
        for tag in _parse_tags(raw):
            counts[tag] = counts.get(tag, 0) + 1

    for (raw,) in db.execute(select(Beta.tags).where(Beta.tags.is_not(None)).limit(100)):
        for tag in _parse_tags(raw):
            counts[tag] = counts.get(tag, 0) + 1

    top = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
    return [TagCount(tag=tag, count=count) for tag, count in top]


def _parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(t).strip() for t in parsed if str(t).strip()]


def recent_posts(db: Session, viewer_id: str | None, limit: int = 6) -> list[Post]:
    stmt = select(Post).where(
        Post.type.in_(["POST", "BETA"]),
        Post.repost_of_id.is_(None),
    )
    excluded = blocked_ids(db, viewer_id)
    condition = _author_not_in(excluded)
    if condition is not None:
        stmt = stmt.where(condition)
    return list(db.scalars(stmt.order_by(Post.created_at.desc()).limit(limit)).all())
