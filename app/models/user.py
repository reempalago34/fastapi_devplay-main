from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, id_pk


class User(Base, TimestampMixin):
    """Equivalente al modelo `User` de prisma/schema.prisma (columnas camelCase)."""

    __tablename__ = "User"

    id: Mapped[str] = id_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column("passwordHash", String(255))

    provider: Mapped[str | None] = mapped_column(String(64))
    provider_account_id: Mapped[str | None] = mapped_column("providerAccountId", String(255))
    reset_token: Mapped[str | None] = mapped_column("resetToken", String(255))
    reset_token_expiry: Mapped[datetime | None] = mapped_column(
        "resetTokenExpiry", DateTime(timezone=True)
    )

    full_name: Mapped[str | None] = mapped_column("fullName", String(255))
    bio: Mapped[str | None] = mapped_column(Text)
    avatar: Mapped[str | None] = mapped_column(Text)
    banner: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    profession: Mapped[str | None] = mapped_column(String(255))
    age: Mapped[int | None] = mapped_column(Integer)
    birth_date: Mapped[datetime | None] = mapped_column("birthDate", DateTime(timezone=True))
    social_links: Mapped[str | None] = mapped_column("socialLinks", Text)  # JSON string
    tags: Mapped[str | None] = mapped_column(Text)  # JSON string array

    role: Mapped[str] = mapped_column(String(16), nullable=False, default="USER")
    is_guest: Mapped[bool] = mapped_column("isGuest", Boolean, nullable=False, default=False)
    is_private: Mapped[bool] = mapped_column("isPrivate", Boolean, nullable=False, default=False)
    two_fa_enabled: Mapped[bool] = mapped_column(
        "twoFAEnabled", Boolean, nullable=False, default=False
    )
    tour_completed: Mapped[bool] = mapped_column(
        "tourCompleted", Boolean, nullable=False, default=False
    )
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="es")

    last_seen: Mapped[datetime | None] = mapped_column("lastSeen", DateTime(timezone=True))
    dev_coins: Mapped[int] = mapped_column("devCoins", Integer, nullable=False, default=100)

    # --- relaciones ---
    posts = relationship("Post", foreign_keys="Post.author_id", lazy="select")
    comments = relationship("Comment", back_populates="user", lazy="select")
    likes = relationship("Like", back_populates="user", lazy="select")
    bookmarks = relationship("Bookmark", back_populates="user", lazy="select")
    streams = relationship("Stream", back_populates="user", lazy="select")

    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        lazy="select",
    )
    followers = relationship(
        "Follow",
        foreign_keys="Follow.followee_id",
        back_populates="followee",
        lazy="select",
    )
    blocked_users = relationship(
        "Block",
        foreign_keys="Block.blocker_id",
        back_populates="blocker",
        lazy="select",
    )
    blocked_by = relationship(
        "Block",
        foreign_keys="Block.blocked_id",
        back_populates="blocked",
        lazy="select",
    )
    reports_made = relationship("Report", back_populates="reporter", lazy="select")

    login_codes = relationship("LoginCode", back_populates="user", lazy="select")
    deletion_codes = relationship(
        "AccountDeletionCode", back_populates="user", lazy="select"
    )
    login_events = relationship("LoginEvent", back_populates="user", lazy="select")

    notifications_received = relationship(
        "Notification",
        foreign_keys="Notification.user_id",
        back_populates="user",
        lazy="select",
    )
    notifications_triggered = relationship(
        "Notification",
        foreign_keys="Notification.from_user_id",
        back_populates="from_user",
        lazy="select",
    )
    chat_messages = relationship("ChatMessage", back_populates="user", lazy="select")
    dms_sent = relationship(
        "DirectMessage",
        foreign_keys="DirectMessage.sender_id",
        back_populates="sender",
        lazy="select",
    )
    dms_received = relationship(
        "DirectMessage",
        foreign_keys="DirectMessage.recipient_id",
        back_populates="recipient",
        lazy="select",
    )
    store_purchases = relationship("StorePurchase", back_populates="user", lazy="select")
    coin_transactions = relationship("DevCoinTransaction", back_populates="user", lazy="select")
    poll_votes = relationship("PollVote", back_populates="user", lazy="select")
