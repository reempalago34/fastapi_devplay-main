from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import RealtimeTokenResponse
from app.utils.realtime import create_realtime_token

router = APIRouter(tags=["realtime"])


@router.get("/realtime-token", response_model=RealtimeTokenResponse)
def realtime_token(user: User = Depends(get_current_user)):
    """Token HMAC de 30 min para el handshake del servicio realtime (sin invitados)."""
    if user.is_guest:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No disponible para invitados")

    settings = get_settings()
    if not (settings.realtime_secret or settings.jwt_secret):
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Falta REALTIME_SECRET")

    token, expires_in = create_realtime_token(user.id, user.username)
    return RealtimeTokenResponse(token=token, expires_in=expires_in)
