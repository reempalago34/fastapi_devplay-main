from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class Poll(Base, CreatedAtMixin):
    __tablename__ = "Poll"
    __table_args__ = (Index("ix_Poll_postId", "postId"),)

    id: Mapped[str] = id_pk()
    post_id: Mapped[str] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    allow_multiple: Mapped[bool] = mapped_column(
        "allowMultiple", Boolean, nullable=False, default=False
    )
    closes_at: Mapped[datetime | None] = mapped_column("closesAt", DateTime(timezone=True))

    post = relationship("Post", back_populates="poll")
    options = relationship(
        "PollOption", back_populates="poll", order_by="PollOption.position", lazy="select"
    )
    votes = relationship("PollVote", back_populates="poll", lazy="select")


class PollOption(Base):
    __tablename__ = "PollOption"
    __table_args__ = (Index("ix_PollOption_pollId", "pollId"),)

    id: Mapped[str] = id_pk()
    poll_id: Mapped[str] = mapped_column(
        "pollId",
        String(40),
        ForeignKey("Poll.id", ondelete="CASCADE"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    vote_count: Mapped[int] = mapped_column("voteCount", Integer, nullable=False, default=0)

    poll = relationship("Poll", back_populates="options")
    votes = relationship("PollVote", back_populates="option", lazy="select")


class PollVote(Base, CreatedAtMixin):
    """Ojo: en Prisma `PollVote.pollId` NO tenía FK (solo índice).

    Aquí sí se crea la FK por integridad referencial (mejora sobre el original).
    """

    __tablename__ = "PollVote"
    __table_args__ = (
        Index("ix_PollVote_pollId", "pollId"),
        Index("ix_PollVote_userId", "userId"),
    )

    id: Mapped[str] = id_pk()
    poll_id: Mapped[str] = mapped_column(
        "pollId",
        String(40),
        ForeignKey("Poll.id", ondelete="CASCADE"),
        nullable=False,
    )
    option_id: Mapped[str] = mapped_column(
        "optionId",
        String(40),
        ForeignKey("PollOption.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )

    poll = relationship("Poll", back_populates="votes")
    option = relationship("PollOption", back_populates="votes")
    user = relationship("User", back_populates="poll_votes")
