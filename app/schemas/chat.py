from datetime import datetime

from pydantic import ConfigDict, Field, field_validator

from app.core.enums import NotificationType
from app.schemas.base import ORMModel


class ChatBase(ORMModel):
    """Alias camelCase para paridad con el schema.prisma original."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )


# ---------------------------------------------------------------- Chat global


class ChatMessageIn(ChatBase):
    """Payload de POST /chat."""

    content: str = Field(min_length=1, max_length=500)

    @field_validator("content")
    @classmethod
    def _strip(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message cannot be empty")
        return stripped


class ChatMessageOut(ChatBase):
    id: str
    user_id: str = Field(alias="userId")
    username: str
    content: str
    created_at: datetime = Field(alias="createdAt")


# ---------------------------------------------------------------- Directos


class DirectMessageIn(ChatBase):
    """Payload de POST /dm/{userId}."""

    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def _strip(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message cannot be empty")
        return stripped


class DirectMessageOut(ChatBase):
    id: str
    sender_id: str = Field(alias="senderId")
    recipient_id: str = Field(alias="recipientId")
    content: str
    read_at: datetime | None = Field(default=None, alias="readAt")
    created_at: datetime = Field(alias="createdAt")


class ConversationSummary(ChatBase):
    """Una fila de GET /dm: con quién y el último mensaje."""

    peer_id: str = Field(alias="peerId")
    peer_username: str = Field(alias="peerUsername")
    peer_avatar: str | None = Field(default=None, alias="peerAvatar")
    last_message: str = Field(alias="lastMessage")
    last_message_at: datetime = Field(alias="lastMessageAt")
    unread_count: int = Field(alias="unreadCount")


# ---------------------------------------------------------------- Notificaciones


class NotificationOut(ChatBase):
    id: str
    type: NotificationType
    message: str
    entity_id: str | None = Field(default=None, alias="entityId")
    read: bool
    from_user_id: str = Field(alias="fromUserId")
    from_username: str = Field(alias="fromUsername")
    created_at: datetime = Field(alias="createdAt")


class NotificationListOut(ChatBase):
    items: list[NotificationOut]
    unread_count: int = Field(alias="unreadCount")
    total: int
    skip: int
    limit: int


class UnreadOut(ChatBase):
    """Contador para el badge de la campana."""

    notifications: int
    direct_messages: int


__all__ = [
    "ChatMessageIn",
    "ChatMessageOut",
    "ConversationSummary",
    "DirectMessageIn",
    "DirectMessageOut",
    "NotificationListOut",
    "NotificationOut",
    "UnreadOut",
]