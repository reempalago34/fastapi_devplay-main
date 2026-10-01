from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.auth import ProfileUpdateRequest
from app.schemas.user import (
    AchievementsResponse,
    BookmarkListResponse,
    FollowersResponse,
    FollowingResponse,
    ProfileResponse,
    StatsResponse,
    UserMe,
    UsernameLookupResponse,
)
from app.services import auth_service
from app.services import user_service as svc

router = APIRouter(prefix="/users", tags=["users"])


# --- Cuenta propia (registradas antes de /{user_id} a propósito) ---


@router.get("/me", response_model=UserMe)
def read_my_profile(user: User = Depends(get_current_user)):
    return user


@router.patch("/me/profile", response_model=UserMe)
def patch_my_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Plantilla de endpoint de escritura: valida con Pydantic → muta → devuelve."""
    return auth_service.update_profile(db, user, payload)


@router.get("/me/stats", response_model=StatsResponse)
def my_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Estadísticas del perfil: contadores, nivel y actividad de 7 días."""
    return StatsResponse(stats=svc.my_stats(db, user.id))


@router.get("/me/achievements", response_model=AchievementsResponse)
def my_achievements(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return svc.my_achievements(db, user.id)


@router.get("/me/bookmarks", response_model=BookmarkListResponse)
def my_bookmarks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return BookmarkListResponse(posts=svc.my_bookmarks(db, user.id, user.id))


# --- Usuarios ---


@router.get("/by-username/{username}", response_model=UsernameLookupResponse)
def read_by_username(username: str, db: Session = Depends(get_db)):
    """Info mínima para menciones @ (404 con {user: null} si no existe)."""
    user = svc.by_username(db, username)
    if user is None:
        return JSONResponse(status_code=404, content={"user": None})
    return UsernameLookupResponse(user={"id": user.id, "username": user.username})


@router.get("/{user_id}", response_model=ProfileResponse)
def read_profile(
    user_id: str,
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Perfil público + últimos 30 posts con contadores y flags del viewer."""
    viewer_id = viewer.id if viewer else None
    return svc.get_profile(db, user_id, viewer_id)


@router.get("/{user_id}/followers", response_model=FollowersResponse)
def read_followers(user_id: str, db: Session = Depends(get_db)):
    followers = svc.list_followers(db, user_id)
    return FollowersResponse(followers=followers, total=len(followers))


@router.get("/{user_id}/following", response_model=FollowingResponse)
def read_following(user_id: str, db: Session = Depends(get_db)):
    following = svc.list_following(db, user_id)
    return FollowingResponse(following=following, total=len(following))
