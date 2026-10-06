from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.buddy import BuddyIn, BuddyOut
from app.services import buddy_service as svc
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/buddy", tags=["buddy"])


@router.post("", response_model=BuddyOut, summary="Platica con Pixel (asistente)")
def ask_buddy(
    payload: BuddyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Conversación con la mascota Pixel 🤖. Solo devs registrados: los
    invitados reciben 401 y el frontend abre el panel de crear cuenta.

    El cerebro es GLM (Z.ai) cuando hay `ZAI_API_KEY`; sin clave responde en
    modo demo. Devuelve también las acciones `[[ir:...]]`/`[[gesto:...]]` que
    el frontend ejecuta (cambiar de vista, animar al robot)."""
    if user.is_guest:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "¡Uy! Solo puedo platicar con devs registrados 🤖 "
            "crea tu cuenta gratis y seguimos.",
        )

    # Igual que el original: 25 mensajes cada 5 minutos por usuario.
    check_rate_limit(f"buddy:{user.id}", 25, 300)

    history = [m for m in payload.messages if m.content.strip()]
    if not history:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Escribe una pregunta para Pixel")

    try:
        raw = svc.chat_complete(svc.history_payload(history))
    except svc.BuddyAIError:
        # El frontend prefiere un 200 con respuesta de Pixel: un error HTTP
        # se traduce en el mensaje genérico "no conecté con mi cabecita".
        raw = svc.OFFLINE_REPLY

    if not raw:
        raw = svc.OFFLINE_REPLY

    reply, actions = svc.extract_actions(raw)
    return BuddyOut(reply=reply, actions=actions)
