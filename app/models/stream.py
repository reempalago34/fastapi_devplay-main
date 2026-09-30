from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class Stream(Base, CreatedAtMixin):
    __tablename__ = "Stream"
    __table_args__ = (
        Index("ix_Stream_userId", "userId"),
        Index("ix_Stream_isLive", "isLive"),
    )

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    post_id: Mapped[str | None] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        unique=True,
    )
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    stream_url: Mapped[str] = mapped_column("streamUrl", Text, nullable=False)
    embed_url: Mapped[str] = mapped_column("embedUrl", Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    is_live: Mapped[bool] = mapped_column("isLive", Boolean, nullable=False, default=False)
    started_at: Mapped[datetime | None] = mapped_column("startedAt", DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column("endedAt", DateTime(timezone=True))

    user = relationship("User", back_populates="streams")
    post = relationship("Post", back_populates="stream")
