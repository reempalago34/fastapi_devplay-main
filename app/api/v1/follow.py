from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.user import FollowActionResponse, FollowRequest, FollowStatusResponse
from app.services import follow_service as svc

router = APIRouter(prefix="/follow", tags=["follow"])


@router.get("", response_model=FollowStatusResponse)
def get_follow_status(
    user_id: str = Query(alias="userId", min_length=1),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Estado de seguimiento + contadores (lectura anónima permitida)."""
    viewer_id = viewer.id if viewer else None
    return FollowStatusResponse(**svc.follow_status(db, viewer_id, user_id))


@router.post("", response_model=FollowActionResponse)
def follow(
    payload: FollowRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sigue a un usuario (idempotente, máx. 30/min). Notifica solo si es nuevo."""
    return FollowActionResponse(**svc.follow_user(db, user.id, payload.followee_id))


@router.delete("", response_model=FollowActionResponse)
def unfollow(
    followee_id: str = Query(alias="followeeId", min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return FollowActionResponse(**svc.unfollow_user(db, user.id, followee_id))
