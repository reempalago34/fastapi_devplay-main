from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.chat import (
    ChatMessageIn,
    ChatMessageOut,
    ConversationSummary,
    DirectMessageIn,
    DirectMessageOut,
    NotificationListOut,
    NotificationOut,
    UnreadOut,
)
from app.services import chat_service as svc
from app.utils.rate_limit import check_rate_limit

router = APIRouter(tags=["chat-dm-notifications"])


# ---------------------------------------------------------------- Chat global


@router.get("/chat", response_model=list[ChatMessageOut], summary="Historial del chat global")
def list_chat(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _viewer: User | None = Depends(get_optional_user),
):
    """Historial del más nuevo al más viejo. No requiere autenticación."""
    messages, _total = svc.list_chat_messages(db, skip=skip, limit=limit)
    return messages


@router.post(
    "/chat",
    response_model=ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Envía un mensaje al chat global",
)
def post_chat(
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_rate_limit(f"chat:post:{user.id}", limit=20, window_seconds=60)
    return svc.post_chat_message(db, user, payload.content)


# ---------------------------------------------------------------- Directos


@router.get("/dm", response_model=list[ConversationSummary], summary="Lista tus conversaciones")
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Una entrada por interlocutor, con el último mensaje y los no leídos."""
    return svc.list_conversations(db, user)


@router.get(
    "/dm/{user_id}",
    response_model=list[DirectMessageOut],
    summary="Historial de la conversación con un usuario",
)
def list_direct_messages(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Los mensajes van de más antiguo a más nuevo, en ambos sentidos."""
    try:
        messages, _total = svc.list_direct_messages(db, user, user_id, skip=skip, limit=limit)
    except svc.UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None
    return messages


@router.post(
    "/dm/{user_id}",
    response_model=DirectMessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Envía un mensaje directo",
)
def send_direct_message(
    user_id: str,
    payload: DirectMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_rate_limit(f"dm:post:{user.id}", limit=30, window_seconds=60)
    try:
        return svc.send_direct_message(db, user, user_id, payload.content)
    except svc.CannotDmYourselfError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Cannot message yourself"
        ) from None
    except svc.UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None


@router.post("/dm/{user_id}/read", response_model=dict, summary="Marca la conversación como leída")
def mark_read(
    user_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marca leídos los mensajes recibidos de ese usuario. Devuelve cuántos eran."""
    try:
        updated = svc.mark_conversation_read(db, user, user_id)
    except svc.UserNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found") from None
    return {"user_id": user_id, "marked": updated}


# ---------------------------------------------------------------- Notificaciones


@router.get(
    "/notifications",
    response_model=NotificationListOut,
    summary="Lista tus notificaciones",
)
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notifications, total = svc.list_notifications(
        db, user, skip=skip, limit=limit, unread_only=unread_only
    )
    items = [
        NotificationOut(
            id=n.id,
            type=n.type,
            message=n.message,
            entity_id=n.entity_id,
            read=n.read,
            from_user_id=n.from_user_id,
            from_username=n.from_user.username if n.from_user else "eliminado",
            created_at=n.created_at,
        )
        for n in notifications
    ]
    return NotificationListOut(
        items=items,
        unread_count=svc.count_unread_notifications(db, user.id),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationOut,
    summary="Marca una notificación como leída",
)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        notification = svc.mark_notification_read(db, notification_id, user)
    except LookupError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found") from None

    return NotificationOut(
        id=notification.id,
        type=notification.type,
        message=notification.message,
        entity_id=notification.entity_id,
        read=notification.read,
        from_user_id=notification.from_user_id,
        from_username=notification.from_user.username if notification.from_user else "eliminado",
        created_at=notification.created_at,
    )


@router.patch("/notifications/read-all", response_model=dict, summary="Marca todas como leídas")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    updated = svc.mark_all_read(db, user)
    return {"marked": updated}


@router.delete(
    "/notifications/{notification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Borra una notificación",
)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        svc.delete_notification(db, notification_id, user)
    except LookupError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found") from None


@router.get("/notifications/unread-count", response_model=UnreadOut, summary="Contador del badge")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Un solo fetch para pintar la campanita y el contador de DMs."""
    return UnreadOut(
        notifications=svc.count_unread_notifications(db, user.id),
        direct_messages=svc.count_unread_dms(db, user.id),
    )