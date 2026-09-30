from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, TimestampMixin, id_pk


class Post(Base, TimestampMixin):
    __tablename__ = "Post"
    __table_args__ = (
        Index("ix_Post_authorId", "authorId"),
        Index("ix_Post_type", "type"),
        Index("ix_Post_createdAt", "createdAt"),
        Index("ix_Post_repostOfId", "repostOfId"),
    )

    id: Mapped[str] = id_pk()
    author_id: Mapped[str] = mapped_column(
        "authorId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="POST")
    content: Mapped[str | None] = mapped_column(Text)
    media_urls: Mapped[str | None] = mapped_column("mediaUrls", Text)  # JSON [{url,kind}]
    repost_of_id: Mapped[str | None] = mapped_column(
        "repostOfId",
        String(40),
        ForeignKey("Post.id", ondelete="SET NULL"),
    )

    author = relationship("User", foreign_keys=[author_id], back_populates="posts")
    repost_of = relationship(
        "Post", remote_side=[id], foreign_keys=[repost_of_id], back_populates="reposts"
    )
    reposts = relationship("Post", back_populates="repost_of")
    beta = relationship("Beta", back_populates="post", uselist=False)
    stream = relationship("Stream", back_populates="post", uselist=False)
    poll = relationship("Poll", back_populates="post", uselist=False)
    comments = relationship("Comment", back_populates="post", lazy="select")
    likes = relationship("Like", back_populates="post", lazy="select")
    bookmarks = relationship("Bookmark", back_populates="post", lazy="select")


class Comment(Base, CreatedAtMixin):
    __tablename__ = "Comment"
    __table_args__ = (
        Index("ix_Comment_postId", "postId"),
        Index("ix_Comment_userId", "userId"),
    )

    id: Mapped[str] = id_pk()
    post_id: Mapped[str] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")


class Like(Base, CreatedAtMixin):
    __tablename__ = "Like"
    __table_args__ = (
        Index("ix_Like_postId", "postId"),
        Index("ix_Like_userId", "userId"),
    )

    id: Mapped[str] = id_pk()
    post_id: Mapped[str] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )

    post = relationship("Post", back_populates="likes")
    user = relationship("User", back_populates="likes")


class Bookmark(Base, CreatedAtMixin):
    __tablename__ = "Bookmark"
    __table_args__ = (
        Index("ix_Bookmark_postId", "postId"),
        Index("ix_Bookmark_userId", "userId"),
    )

    id: Mapped[str] = id_pk()
    post_id: Mapped[str] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )

    post = relationship("Post", back_populates="bookmarks")
    user = relationship("User", back_populates="bookmarks")
