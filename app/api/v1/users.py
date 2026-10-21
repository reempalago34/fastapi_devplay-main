from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
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
    LikedPostsResponse,
    MediaListResponse,
    OkResponse,
    ProfileResponse,
    StatsResponse,
    UploadOut,
    UserMe,
    UsernameLookupResponse,
)
from app.services import auth_service
from app.services import media_service as media_svc
from app.services import user_service as svc
from app.utils.rate_limit import check_rate_limit

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


@router.post("/me/media", response_model=UploadOut, status_code=status.HTTP_201_CREATED)
def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Sube una imagen o un video (avatar, portada o galería).

    Valida el tipo MIME, la extensión y el tamaño. Devuelve la URL pública
    del archivo, listo para guardarlo en el perfil o en una publicación.
    """
    check_rate_limit(f"media:upload:{user.id}", limit=20, window_seconds=60)
    try:
        uploaded = media_svc.save_upload(file, user.id)
    except media_svc.UploadError as exc:
        raise media_svc.http_error(exc) from None
    return UploadOut(
        url=uploaded.url,
        kind=uploaded.kind,
        filename=uploaded.filename,
        size=uploaded.size,
    )


@router.delete("/me/media", response_model=OkResponse)
def delete_media(
    url: str = Query(..., min_length=1, description="URL del archivo a borrar"),
    user: User = Depends(get_current_user),
):
    """Borra un archivo subido previamente por su URL."""
    deleted = media_svc.delete_upload(url)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return OkResponse(ok=True)


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


@router.get("/{user_id}/likes", response_model=LikedPostsResponse)
def read_liked_posts(
    user_id: str,
    limit: int = Query(50, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Pestaña 'Me gusta': publicaciones que el usuario marcó como me gusta."""
    viewer_id = viewer.id if viewer else None
    items = svc.list_liked_posts(db, user_id, viewer_id, limit=limit)
    return LikedPostsResponse(items=items)


@router.get("/{user_id}/media", response_model=MediaListResponse)
def read_user_media(
    user_id: str,
    limit: int = Query(60, ge=1, le=200),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Pestaña 'Multimedia': galería de imágenes y videos del usuario."""
    viewer_id = viewer.id if viewer else None
    items = svc.list_user_media(db, user_id, viewer_id, limit=limit)
    return MediaListResponse(items=items)
