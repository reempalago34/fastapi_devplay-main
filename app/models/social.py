from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class Follow(Base, CreatedAtMixin):
    __tablename__ = "Follow"
    __table_args__ = (
        Index("ix_Follow_followerId", "followerId"),
        Index("ix_Follow_followeeId", "followeeId"),
    )

    id: Mapped[str] = id_pk()
    follower_id: Mapped[str] = mapped_column(
        "followerId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    followee_id: Mapped[str] = mapped_column(
        "followeeId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )

    follower = relationship(
        "User", foreign_keys=[follower_id], back_populates="following"
    )
    followee = relationship(
        "User", foreign_keys=[followee_id], back_populates="followers"
    )


class Block(Base, CreatedAtMixin):
    __tablename__ = "Block"
    __table_args__ = (
        Index("ix_Block_blockerId", "blockerId"),
        Index("ix_Block_blockedId", "blockedId"),
    )

    id: Mapped[str] = id_pk()
    blocker_id: Mapped[str] = mapped_column(
        "blockerId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    blocked_id: Mapped[str] = mapped_column(
        "blockedId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )

    blocker = relationship("User", foreign_keys=[blocker_id], back_populates="blocked_users")
    blocked = relationship("User", foreign_keys=[blocked_id], back_populates="blocked_by")


class Report(Base, CreatedAtMixin):
    __tablename__ = "Report"
    __table_args__ = (
        Index("ix_Report_reporterId", "reporterId"),
        Index("ix_Report_status", "status"),
    )

    id: Mapped[str] = id_pk()
    reporter_id: Mapped[str] = mapped_column(
        "reporterId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # POST|USER|COMMENT|BETA
    entity_id: Mapped[str] = mapped_column("entityId", String(40), nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")

    reporter = relationship("User", back_populates="reports_made")
