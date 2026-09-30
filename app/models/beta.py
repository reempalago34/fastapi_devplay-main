from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class Beta(Base, CreatedAtMixin):
    """Ficha de juego (1:1 con un Post de tipo BETA)."""

    __tablename__ = "Beta"
    __table_args__ = (Index("ix_Beta_postId", "postId"),)

    id: Mapped[str] = id_pk()
    post_id: Mapped[str] = mapped_column(
        "postId",
        String(40),
        ForeignKey("Post.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    download_type: Mapped[str] = mapped_column("downloadType", String(16), nullable=False)
    file_url: Mapped[str | None] = mapped_column("fileUrl", Text)
    file_size: Mapped[int | None] = mapped_column("fileSize", Integer)
    file_name: Mapped[str | None] = mapped_column("fileName", Text)
    external_url: Mapped[str | None] = mapped_column("externalUrl", Text)
    beta_status: Mapped[str] = mapped_column(
        "betaStatus", String(32), nullable=False, default="open_beta"
    )
    genre: Mapped[str | None] = mapped_column(String(64))
    version: Mapped[str | None] = mapped_column(String(32))
    platforms: Mapped[str | None] = mapped_column(Text)  # JSON array
    tags: Mapped[str | None] = mapped_column(Text)  # JSON array
    requirements: Mapped[str | None] = mapped_column(Text)
    changelog: Mapped[str | None] = mapped_column(Text)
    install_instructions: Mapped[str | None] = mapped_column("installInstructions", Text)
    cover_image: Mapped[str | None] = mapped_column("coverImage", Text)
    screenshots: Mapped[str | None] = mapped_column(Text)  # JSON array de URLs
    external_platform: Mapped[str | None] = mapped_column("externalPlatform", String(64))
    downloads: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    post = relationship("Post", back_populates="beta")
