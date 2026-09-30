from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class Notification(Base, CreatedAtMixin):
    __tablename__ = "Notification"
    __table_args__ = (
        Index("ix_Notification_userId", "userId"),
        Index("ix_Notification_read", "read"),
    )

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_user_id: Mapped[str] = mapped_column(
        "fromUserId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # LIVE|FOLLOW|COMMENT|LIKE
    message: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str | None] = mapped_column("entityId", String(40))
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship(
        "User", foreign_keys=[user_id], back_populates="notifications_received"
    )
    from_user = relationship(
        "User", foreign_keys=[from_user_id], back_populates="notifications_triggered"
    )


class ChatMessage(Base, CreatedAtMixin):
    __tablename__ = "ChatMessage"
    __table_args__ = (Index("ix_ChatMessage_createdAt", "createdAt"),)

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False)  # denormalizado
    content: Mapped[str] = mapped_column(Text, nullable=False)

    user = relationship("User", back_populates="chat_messages")


class DirectMessage(Base, CreatedAtMixin):
    __tablename__ = "DirectMessage"
    __table_args__ = (
        Index("ix_DirectMessage_senderId_recipientId", "senderId", "recipientId"),
        Index("ix_DirectMessage_recipientId_readAt", "recipientId", "readAt"),
        Index("ix_DirectMessage_createdAt", "createdAt"),
    )

    id: Mapped[str] = id_pk()
    sender_id: Mapped[str] = mapped_column(
        "senderId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    recipient_id: Mapped[str] = mapped_column(
        "recipientId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column("readAt", DateTime(timezone=True))

    sender = relationship(
        "User", foreign_keys=[sender_id], back_populates="dms_sent"
    )
    recipient = relationship(
        "User", foreign_keys=[recipient_id], back_populates="dms_received"
    )
