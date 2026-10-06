from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage, DirectMessage, Notification
from app.models.user import User


class UserNotFoundError(LookupError):
    pass


class CannotDmYourselfError(ValueError):
    pass


def _utcnow() -> datetime:
    return datetime.now(UTC)


def get_user_or_404(db: Session, user_id: str) -> User:
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise UserNotFoundError()
    return user


# ---------------------------------------------------------------- Chat global


def post_chat_message(db: Session, user: User, content: str) -> ChatMessage:
    """Envía un mensaje al chat global. `username` va denormalizado a propósito."""
    message = ChatMessage(user_id=user.id, username=user.username, content=content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def list_chat_messages(
    db: Session, skip: int = 0, limit: int = 50
) -> tuple[list[ChatMessage], int]:
    """Historial del chat global, del más nuevo al más viejo."""
    total = db.scalar(select(func.count()).select_from(ChatMessage)) or 0
    stmt = (
        select(ChatMessage)
        .order_by(ChatMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all()), total


# ---------------------------------------------------------------- Directos


def send_direct_message(
    db: Session, sender: User, recipient_id: str, content: str
) -> DirectMessage:
    """Envía un DM. No se permite consigo mismo."""
    if sender.id == recipient_id:
        raise CannotDmYourselfError()
    get_user_or_404(db, recipient_id)

    message = DirectMessage(
        sender_id=sender.id, recipient_id=recipient_id, content=content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def list_direct_messages(
    db: Session, user: User, peer_id: str, skip: int = 0, limit: int = 50
) -> tuple[list[DirectMessage], int]:
    """Conversación con `peer_id` en ambos sentidos, del más antiguo al más nuevo."""
    get_user_or_404(db, peer_id)

    condition = or_(
        (DirectMessage.sender_id == user.id) & (DirectMessage.recipient_id == peer_id),
        (DirectMessage.sender_id == peer_id) & (DirectMessage.recipient_id == user.id),
    )
    total = db.scalar(
        select(func.count()).select_from(DirectMessage).where(condition)
    ) or 0
    stmt = (
        select(DirectMessage)
        .where(condition)
        .order_by(DirectMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all()), total


def list_conversations(db: Session, user: User) -> list[dict]:
    """Una fila por interlocutor, con su último mensaje y los no leídos.

    Se hace con una sola consulta de DMs y otra de no leídos (evita N+1).
    """
    mine = or_(
        DirectMessage.sender_id == user.id,
        DirectMessage.recipient_id == user.id,
    )
    messages = db.scalars(
        select(DirectMessage).where(mine).order_by(DirectMessage.created_at.asc())
    ).all()
    if not messages:
        return []

    # peer_id es el otro extremo de cada mensaje.
    pairs: dict[str, list[DirectMessage]] = {}
    for message in messages:
        peer_id = (
            message.recipient_id if message.sender_id == user.id else message.sender_id
        )
        pairs.setdefault(peer_id, []).append(message)

    # IDs de los peers para traer sus perfiles en una sola query.
    peer_ids = list(pairs.keys())
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_(peer_ids))).all()}

    unread_rows = db.execute(
        select(DirectMessage.sender_id, func.count())
        .where(
            DirectMessage.recipient_id == user.id,
            DirectMessage.read_at.is_(None),
        )
        .group_by(DirectMessage.sender_id)
    ).all()
    unread = dict(unread_rows)

    conversations = []
    for peer_id, thread in pairs.items():
        peer = users.get(peer_id)
        last = thread[-1]
        conversations.append(
            {
                "peer_id": peer_id,
                "peer_username": peer.username if peer else "eliminado",
                "peer_avatar": peer.avatar if peer else None,
                "last_message": last.content,
                "last_message_at": last.created_at,
                "unread_count": unread.get(peer_id, 0),
            }
        )

    # La conversación con el último mensaje más reciente primero.
    conversations.sort(key=lambda c: c["last_message_at"], reverse=True)
    return conversations


def mark_conversation_read(db: Session, user: User, peer_id: str) -> int:
    """Marca como leídos los DMs que el peer envió y el usuario aún no había leído."""
    get_user_or_404(db, peer_id)
    result = db.execute(
        DirectMessage.__table__.update()
        .where(
            DirectMessage.__table__.c.recipientId == user.id,
            DirectMessage.__table__.c.senderId == peer_id,
            DirectMessage.__table__.c.readAt.is_(None),
        )
        .values(readAt=_utcnow())
    )
    db.commit()
    return result.rowcount or 0


def count_unread_dms(db: Session, user_id: str) -> int:
    stmt = select(func.count()).select_from(DirectMessage).where(
        DirectMessage.recipient_id == user_id, DirectMessage.read_at.is_(None)
    )
    return db.scalar(stmt) or 0


# ---------------------------------------------------------------- Notificaciones


def list_notifications(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
) -> tuple[list[Notification], int]:
    stmt = select(Notification).where(Notification.user_id == user.id)
    count_stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id
    )
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
        count_stmt = count_stmt.where(Notification.read.is_(False))

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all()), total


def count_unread_notifications(db: Session, user_id: str) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id, Notification.read.is_(False)
    )
    return db.scalar(stmt) or 0


def get_notification_or_404(db: Session, notification_id: str, user: User) -> Notification:
    """Solo devuelve notificaciones que pertenecen al usuario."""
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if notification is None:
        raise LookupError()
    return notification


def mark_notification_read(db: Session, notification_id: str, user: User) -> Notification:
    notification = get_notification_or_404(db, notification_id, user)
    if not notification.read:
        notification.read = True
        db.add(notification)
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_read(db: Session, user: User) -> int:
    result = db.execute(
        Notification.__table__.update()
        .where(
            Notification.__table__.c.userId == user.id,
            Notification.__table__.c.read.is_(False),
        )
        .values(read=True)
    )
    db.commit()
    return result.rowcount or 0


def delete_notification(db: Session, notification_id: str, user: User) -> None:
    notification = get_notification_or_404(db, notification_id, user)
    db.delete(notification)
    db.commit()


def create_notification(
    db: Session,
    user_id: str,
    from_user_id: str,
    type_: str,
    message: str,
    entity_id: str | None = None,
) -> Notification:
    """Crea una notificación. La usan likes, comentarios, follows y directos en vivo."""
    notification = Notification(
        user_id=user_id,
        from_user_id=from_user_id,
        type=type_,
        message=message,
        entity_id=entity_id,
        read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


__all__ = [
    "CannotDmYourselfError",
    "UserNotFoundError",
    "count_unread_dms",
    "count_unread_notifications",
    "create_notification",
    "delete_notification",
    "get_notification_or_404",
    "get_user_or_404",
    "list_chat_messages",
    "list_conversations",
    "list_direct_messages",
    "list_notifications",
    "mark_all_read",
    "mark_conversation_read",
    "mark_notification_read",
    "post_chat_message",
    "send_direct_message",
]