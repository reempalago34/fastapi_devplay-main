"""Perfiles públicos, listas de seguidores, stats, logros y bookmarks.

Port desde devplay-main/src/app/api/devplay/users/*/route.ts
"""

import logging
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.beta import Beta
from app.models.content import Bookmark, Comment, Like, Post
from app.models.social import Block, Follow
from app.models.stream import Stream
from app.models.user import User
from app.schemas.user import (
    AchievementsResponse,
    AuthorOut,
    BetaOut,
    FollowListUser,
    PostSummary,
    ProfileUser,
    RepostSummary,
    StreamOut,
    UserStats,
)
from app.utils.json_fields import loads_json

logger = logging.getLogger("devplay.users")


def _parse_tags(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    parsed = loads_json(raw, [])
    return parsed if isinstance(parsed, list) else None


def _count(db, model, *criteria) -> int:
    query = select(func.count()).select_from(model)
    if criteria:
        query = query.where(*criteria)
    return int(db.scalar(query) or 0)


def _bulk_counts(db, post_ids: list[str]) -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
    """Likes, comentarios y reposts por post en 3 consultas (evita N+1)."""
    if not post_ids:
        return {}, {}, {}

    def group(column):
        rows = db.execute(
            select(column, func.count()).where(column.in_(post_ids)).group_by(column)
        )
        return {key: int(value) for key, value in rows}

    return group(Like.post_id), group(Comment.post_id), group(Post.repost_of_id)


def serialize_posts(db, posts, viewer_id: str | None = None) -> list[PostSummary]:
    post_ids = [p.id for p in posts]
    repost_ids = [p.repost_of_id for p in posts if p.repost_of_id]
    all_ids = list({*post_ids, *repost_ids})

    likes, comments, reposts = _bulk_counts(db, all_ids)
    liked_ids: set[str] = set()
    if viewer_id and all_ids:
        liked_ids = set(
            db.scalars(
                select(Like.post_id).where(
                    Like.post_id.in_(all_ids), Like.user_id == viewer_id
                )
            )
        )

    def author_out(user: User) -> AuthorOut:
        return AuthorOut(
            id=user.id,
            username=user.username,
            avatar=user.avatar,
            role=user.role,
            tags=_parse_tags(user.tags),
        )

    results: list[PostSummary] = []
    for post in posts:
        repost_summary = None
        if post.repost_of is not None:
            root = post.repost_of
            repost_summary = RepostSummary(
                id=root.id,
                type=root.type,
                content=root.content,
                mediaUrls=loads_json(root.media_urls, []),
                createdAt=root.created_at,
                author=author_out(root.author),
                beta=BetaOut.model_validate(root.beta) if root.beta else None,
                stream=StreamOut.model_validate(root.stream) if root.stream else None,
                likesCount=likes.get(root.id, 0),
                commentsCount=comments.get(root.id, 0),
            )

        results.append(
            PostSummary(
                id=post.id,
                type=post.type,
                content=post.content,
                mediaUrls=loads_json(post.media_urls, []),
                createdAt=post.created_at,
                author=author_out(post.author),
                beta=BetaOut.model_validate(post.beta) if post.beta else None,
                stream=StreamOut.model_validate(post.stream) if post.stream else None,
                repostOf=repost_summary,
                likesCount=likes.get(post.id, 0),
                commentsCount=comments.get(post.id, 0),
                repostsCount=reposts.get(post.id, 0),
                liked=post.id in liked_ids,
            )
        )
    return results


# ------------------------------ Perfil público ------------------------------


def get_profile(db, user_id: str, viewer_id: str | None) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontrado")

    followers_count = _count(db, Follow, Follow.followee_id == user_id)
    following_count = _count(db, Follow, Follow.follower_id == user_id)
    posts_count = _count(db, Post, Post.author_id == user_id)

    is_following = is_blocked = blocked_me = False
    if viewer_id and viewer_id != user_id:
        is_following = (
            db.scalar(
                select(Follow).where(
                    Follow.follower_id == viewer_id, Follow.followee_id == user_id
                )
            )
            is not None
        )
        is_blocked = (
            db.scalar(
                select(Block).where(
                    Block.blocker_id == viewer_id, Block.blocked_id == user_id
                )
            )
            is not None
        )
        blocked_me = (
            db.scalar(
                select(Block).where(
                    Block.blocker_id == user_id, Block.blocked_id == viewer_id
                )
            )
            is not None
        )

    posts = db.scalars(
        select(Post)
        .where(Post.author_id == user_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.beta),
            selectinload(Post.stream),
            selectinload(Post.repost_of).selectinload(Post.author),
            selectinload(Post.repost_of).selectinload(Post.beta),
            selectinload(Post.repost_of).selectinload(Post.stream),
        )
        .order_by(Post.created_at.desc())
        .limit(30)
    ).all()

    profile = ProfileUser(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        avatar=user.avatar,
        banner=user.banner,
        role=user.role,
        is_guest=user.is_guest,
        tags=_parse_tags(user.tags),
        location=user.location,
        website=user.website,
        profession=user.profession,
        birth_date=user.birth_date,
        social_links=user.social_links,
        last_seen=user.last_seen,
        created_at=user.created_at,
        followers_count=followers_count,
        following_count=following_count,
        posts_count=posts_count,
        is_following=is_following,
        is_blocked=is_blocked,
        blocked_me=blocked_me,
    )
    return {"user": profile, "posts": serialize_posts(db, posts, viewer_id)}


# --------------------------- Seguidores / seguidos ---------------------------


def _follow_list(db, rows) -> list[FollowListUser]:
    if not rows:
        return []
    user_ids = [user.id for _, user in rows]

    follower_counts = {
        key: int(value)
        for key, value in db.execute(
            select(Follow.followee_id, func.count())
            .where(Follow.followee_id.in_(user_ids))
            .group_by(Follow.followee_id)
        )
    }
    post_counts = {
        key: int(value)
        for key, value in db.execute(
            select(Post.author_id, func.count())
            .where(Post.author_id.in_(user_ids))
            .group_by(Post.author_id)
        )
    }
    return [
        FollowListUser(
            id=user.id,
            username=user.username,
            avatar=user.avatar,
            bio=user.bio,
            role=user.role,
            tags=_parse_tags(user.tags),
            followers_count=follower_counts.get(user.id, 0),
            posts_count=post_counts.get(user.id, 0),
            followed_at=follow.created_at,
        )
        for follow, user in rows
    ]


def list_followers(db, user_id: str) -> list[FollowListUser]:
    rows = db.execute(
        select(Follow, User)
        .join(User, User.id == Follow.follower_id)
        .where(Follow.followee_id == user_id)
        .order_by(Follow.created_at.desc())
        .limit(100)
    ).all()
    return _follow_list(db, rows)


def list_following(db, user_id: str) -> list[FollowListUser]:
    rows = db.execute(
        select(Follow, User)
        .join(User, User.id == Follow.followee_id)
        .where(Follow.follower_id == user_id)
        .order_by(Follow.created_at.desc())
        .limit(100)
    ).all()
    return _follow_list(db, rows)


def by_username(db, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


# --------------------------------- Stats -----------------------------------


def my_stats(db, user_id: str) -> UserStats:
    posts = _count(db, Post, Post.author_id == user_id)
    comments = _count(db, Comment, Comment.user_id == user_id)
    likes = _count(db, Like, Like.user_id == user_id)
    followers = _count(db, Follow, Follow.followee_id == user_id)
    following = _count(db, Follow, Follow.follower_id == user_id)
    bookmarks = _count(db, Bookmark, Bookmark.user_id == user_id)

    betas = int(
        db.scalar(
            select(func.count())
            .select_from(Beta)
            .join(Post, Beta.post_id == Post.id)
            .where(Post.author_id == user_id)
        )
        or 0
    )
    total_downloads = int(
        db.scalar(
            select(func.coalesce(func.sum(Beta.downloads), 0))
            .join(Post, Beta.post_id == Post.id)
            .where(Post.author_id == user_id)
        )
        or 0
    )
    total_likes_received = _count(
        db, Like, Like.post_id.in_(select(Post.id).where(Post.author_id == user_id))
    )
    total_comments_received = _count(
        db, Comment, Comment.post_id.in_(select(Post.id).where(Post.author_id == user_id))
    )

    # Actividad de los últimos 7 días (posts por día)
    since = datetime.now(UTC) - timedelta(days=6)
    created_dates = db.scalars(
        select(Post.created_at).where(
            Post.author_id == user_id, Post.created_at >= since
        )
    ).all()
    per_day: dict[str, int] = defaultdict(int)
    for ts in created_dates:
        # Normaliza a UTC: Postgres devuelve el timestamptz en la TZ de sesión
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        per_day[ts.astimezone(UTC).date().isoformat()] += 1

    today = datetime.now(UTC).date()
    activity_by_day = []
    for i in range(6, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        activity_by_day.append({"date": day, "count": per_day.get(day, 0)})

    # Nivel: 1 punto por post, 2 por beta, 1 por like recibido, 3 por seguidor
    points = posts + betas * 2 + total_likes_received + followers * 3
    level = points // 10 + 1

    return UserStats(
        posts=posts,
        comments=comments,
        likes=likes,
        betas=betas,
        followers=followers,
        following=following,
        bookmarks=bookmarks,
        total_downloads=total_downloads,
        total_likes_received=total_likes_received,
        total_comments_received=total_comments_received,
        points=points,
        level=level,
        points_for_next_level=level * 10,
        progress_to_next=(points % 10) / 10 * 100,
        activity_by_day=activity_by_day,
    )


# ------------------------------- Achievements -------------------------------


def _achievement(
    id_: str, label: str, description: str, emoji: str, value: int, target: int, tier: str
) -> dict:
    return {
        "id": id_,
        "label": label,
        "description": description,
        "emoji": emoji,
        "unlocked": value >= target,
        "progress": min(value, target),
        "target": target,
        "tier": tier,
    }


def my_achievements(db, user_id: str) -> AchievementsResponse:
    posts = _count(db, Post, Post.author_id == user_id, Post.type == "POST")
    comments = _count(db, Comment, Comment.user_id == user_id)
    likes = _count(db, Like, Like.user_id == user_id)
    followers = _count(db, Follow, Follow.followee_id == user_id)
    following = _count(db, Follow, Follow.follower_id == user_id)
    bookmarks = _count(db, Bookmark, Bookmark.user_id == user_id)
    streams = _count(db, Stream, Stream.user_id == user_id)
    betas = int(
        db.scalar(
            select(func.count())
            .select_from(Beta)
            .join(Post, Beta.post_id == Post.id)
            .where(Post.author_id == user_id)
        )
        or 0
    )
    total_downloads = int(
        db.scalar(
            select(func.coalesce(func.sum(Beta.downloads), 0))
            .join(Post, Beta.post_id == Post.id)
            .where(Post.author_id == user_id)
        )
        or 0
    )
    total_likes_received = _count(
        db, Like, Like.post_id.in_(select(Post.id).where(Post.author_id == user_id))
    )

    values = {
        "posts": posts,
        "betas": betas,
        "downloads": total_downloads,
        "likes_received": total_likes_received,
        "comments": comments,
        "followers": followers,
        "streams": streams,
        "likes": likes,
        "bookmarks": bookmarks,
        "following": following,
    }

    # (id, label, descripción, emoji, métrica, objetivo, tier)
    definitions = [
        ("first-post", "Primer paso", "Publica tu primera publicación", "📝", "posts", 1, "bronze"),
        ("posts-10", "Activo", "Publica 10 publicaciones", "✍️", "posts", 10, "silver"),
        ("posts-50", "Prolífico", "Publica 50 publicaciones", "📚", "posts", 50, "gold"),
        ("first-beta", "Desarrollador", "Sube tu primera beta", "🎮", "betas", 1, "bronze"),
        ("betas-5", "Estudio indie", "Sube 5 betas", "🕹️", "betas", 5, "silver"),
        ("betas-10", "Estudio pro", "Sube 10 betas", "🏆", "betas", 10, "gold"),
        ("downloads-10", "Probado", "Consigue 10 descargas", "⬇️", "downloads", 10, "bronze"),
        ("downloads-100", "Popular", "Consigue 100 descargas", "🔥", "downloads", 100, "silver"),
        ("downloads-1000", "Viral", "Consigue 1000 descargas", "💥", "downloads", 1000, "platinum"),
        ("likes-10", "Apreciado", "Recibe 10 likes", "❤️", "likes_received", 10, "bronze"),
        ("likes-100", "Querido", "Recibe 100 likes", "💖", "likes_received", 100, "silver"),
        ("comments-5", "Conversador", "Comenta 5 veces", "💬", "comments", 5, "bronze"),
        ("comments-50", "Sociable", "Comenta 50 veces", "🗣️", "comments", 50, "silver"),
        ("followers-1", "Seguido", "Consigue tu primer seguidor", "👥", "followers", 1, "bronze"),
        ("followers-10", "Influencer", "Consigue 10 seguidores", "⭐", "followers", 10, "silver"),
        ("followers-100", "Estrella", "Consigue 100 seguidores", "🌟", "followers", 100, "gold"),
        ("first-stream", "Streamear", "Haz tu primer directo", "📡", "streams", 1, "bronze"),
        ("streams-10", "Streamer", "Haz 10 directos", "🎬", "streams", 10, "silver"),
        ("likes-given-10", "Generoso", "Da 10 likes", "👍", "likes", 10, "bronze"),
        ("bookmarks-5", "Coleccionista", "Guarda 5 publicaciones", "🔖", "bookmarks", 5, "bronze"),
        ("following-5", "Curioso", "Sigue a 5 usuarios", "👀", "following", 5, "bronze"),
    ]

    achievements = [
        _achievement(id_, label, desc, emoji, values[metric], target, tier)
        for id_, label, desc, emoji, metric, target, tier in definitions
    ]
    return AchievementsResponse(
        achievements=achievements,
        total_unlocked=sum(1 for a in achievements if a["unlocked"]),
        total=len(achievements),
    )


# -------------------------------- Bookmarks --------------------------------


def my_bookmarks(db, user_id: str, viewer_id: str) -> list[PostSummary]:
    saved_at_by_post = dict(
        db.execute(
            select(Bookmark.post_id, Bookmark.created_at).where(
                Bookmark.user_id == user_id
            )
        ).all()
    )
    posts = db.scalars(
        select(Post)
        .join(Bookmark, Bookmark.post_id == Post.id)
        .where(Bookmark.user_id == user_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.beta),
            selectinload(Post.stream),
            selectinload(Post.repost_of).selectinload(Post.author),
            selectinload(Post.repost_of).selectinload(Post.beta),
            selectinload(Post.repost_of).selectinload(Post.stream),
        )
        .order_by(Bookmark.created_at.desc())
        .limit(50)
    ).all()

    serialized = serialize_posts(db, posts, viewer_id)
    for item in serialized:
        item.saved_at = saved_at_by_post.get(item.id)
    return serialized
