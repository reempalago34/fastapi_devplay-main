from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.beta import (
    BetaCreate,
    BetaDownloadOut,
    BetaOut,
    BetaUpdate,
    StreamGoLiveIn,
    StreamOut,
)
from app.services import beta_service as svc
from app.utils.rate_limit import check_rate_limit

router = APIRouter(tags=["betas-streams"])


# ---------------------------------------------------------------- Betas


@router.get("/betas", response_model=list[BetaOut], summary="Lista betas")
def list_betas(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    beta_status: str | None = Query(None, description="Filtra por estado de la beta"),
    author_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    betas, _total = svc.list_betas(
        db, skip=skip, limit=limit, beta_status=beta_status, author_id=author_id
    )
    return betas


@router.post(
    "/betas",
    response_model=BetaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Publica una beta (crea el post y la ficha)",
)
def create_beta(
    payload: BetaCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Crea el post de tipo BETA junto a su ficha."""
    check_rate_limit(f"beta:create:{user.id}", limit=10, window_seconds=3600)
    return svc.create_beta(db, user, payload)


@router.get("/betas/{beta_id}", response_model=BetaOut, summary="Ver una beta")
def get_beta(
    beta_id: str,
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    try:
        return svc.get_beta_or_404(db, beta_id)
    except svc.BetaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Beta not found") from None


@router.patch("/betas/{beta_id}", response_model=BetaOut, summary="Edita una beta (solo autor)")
def update_beta(
    beta_id: str,
    payload: BetaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        beta = svc.get_beta_or_404(db, beta_id)
    except svc.BetaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Beta not found") from None

    try:
        return svc.update_beta(db, beta, user, payload)
    except svc.NotBetaAuthorError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not the author of this beta") from None


@router.post(
    "/betas/{beta_id}/download",
    response_model=BetaDownloadOut,
    summary="Registra y devuelve la descarga",
)
def download_beta(
    beta_id: str,
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    """Suma al contador y devuelve la URL a la que ir (o el fichero si es DIRECT)."""
    try:
        beta = svc.get_beta_or_404(db, beta_id)
    except svc.BetaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Beta not found") from None

    try:
        url, file_name, file_size = svc.resolve_download(beta)
    except svc.InvalidDownloadError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from None

    beta = svc.register_download(db, beta)
    return BetaDownloadOut(
        beta_id=beta.id,
        download_type=beta.download_type,
        url=url,
        file_name=file_name,
        file_size=file_size,
        downloads=beta.downloads,
    )


@router.get("/betas/{beta_id}/downloads", response_model=dict, summary="Descargas en 7 días")
def download_history(
    beta_id: str,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    """Placeholder: el conteo por día se sirve desde el frontend por ahora."""
    try:
        beta = svc.get_beta_or_404(db, beta_id)
    except svc.BetaNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Beta not found") from None

    since = datetime.now(UTC) - timedelta(days=days)
    return {
        "beta_id": beta.id,
        "total": beta.downloads,
        "since": since.isoformat(),
        "days": days,
    }


# ---------------------------------------------------------------- Streams


@router.get("/streams", response_model=list[StreamOut], summary="Lista los directos")
def list_streams(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    live_only: bool = Query(False, description="Solo los que están en vivo"),
    platform: str | None = Query(None),
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    streams, _total = svc.list_streams(
        db, skip=skip, limit=limit, live_only=live_only, platform=platform
    )
    return streams


@router.get("/streams/live", response_model=list[StreamOut], summary="Solo los directos activos")
def list_live_streams(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    streams, _total = svc.list_streams(db, limit=limit, live_only=True)
    return streams


@router.post(
    "/streams/go-live",
    response_model=StreamOut,
    status_code=status.HTTP_201_CREATED,
    summary="Empieza a emitir",
)
def go_live(
    payload: StreamGoLiveIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marca el directo como en vivo. Solo se permite uno activo por usuario."""
    check_rate_limit(f"stream:golive:{user.id}", limit=10, window_seconds=3600)
    try:
        return svc.go_live(db, user, payload)
    except svc.AlreadyLiveError:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a live stream") from None


@router.post("/streams/go-offline", response_model=StreamOut, summary="Termina la emisión")
def go_offline(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cierra el directo activo. 409 si el usuario no está emitiendo."""
    try:
        return svc.go_offline(db, user)
    except svc.NotLiveError:
        raise HTTPException(status.HTTP_409_CONFLICT, "You are not live") from None


@router.get("/streams/{stream_id}", response_model=StreamOut, summary="Ver un directo")
def get_stream(
    stream_id: str,
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    try:
        return svc.get_stream_or_404(db, stream_id)
    except svc.StreamNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stream not found") from None