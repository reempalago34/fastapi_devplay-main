"""Seguir / dejar de seguir usuarios.

Port desde devplay-main/src/app/api/devplay/follow/route.ts
"""

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.chat import Notification
from app.models.social import Follow
from app.models.user import User
from app.utils.rate_limit import check_rate_limit


def follow_status(db: Session, viewer_id: str | None, target_id: str) -> dict:
    followers_count = int(
        db.scalar(
            select(func.count()).select_from(Follow).where(Follow.followee_id == target_id)
        )
        or 0
    )
    following_count = int(
        db.scalar(
            select(func.count()).select_from(Follow).where(Follow.follower_id == target_id)
        )
        or 0
    )
    existing = (
        db.scalar(
            select(Follow).where(
                Follow.follower_id == viewer_id, Follow.followee_id == target_id
            )
        )
        if viewer_id
        else None
    )
    return {
        "following": existing is not None,
        "followersCount": followers_count,
        "followingCount": following_count,
    }


def follow_user(db: Session, current_user_id: str, followee_id: str) -> dict:
    check_rate_limit(f"follow:{current_user_id}", limit=30, window_seconds=60)

    if not followee_id or followee_id == current_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Inválido")

    target = db.get(User, followee_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")

    existing = db.scalar(
        select(Follow).where(
            Follow.follower_id == current_user_id, Follow.followee_id == followee_id
        )
    )
    if existing is not None:
        # Idempotente como en el original (ya sigues a esta cuenta)
        return {"following": True}

    follower = db.get(User, current_user_id)
    db.add(Follow(follower_id=current_user_id, followee_id=followee_id))
    # Solo se notifica cuando el follow es nuevo (el original notificaba siempre)
    db.add(
        Notification(
            user_id=followee_id,
            from_user_id=current_user_id,
            type="FOLLOW",
            message=f"{follower.username if follower else ''} te empezó a seguir",
            entity_id=current_user_id,
        )
    )
    db.commit()
    return {"following": True}


def unfollow_user(db: Session, current_user_id: str, followee_id: str) -> dict:
    if not followee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "followeeId required")
    db.execute(
        delete(Follow).where(
            Follow.follower_id == current_user_id, Follow.followee_id == followee_id
        )
    )
    db.commit()
    return {"following": False}
