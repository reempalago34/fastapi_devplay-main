"""Archivos subidos por el usuario (avatar, portada, galería).

Se guardan en disco (carpeta `MEDIA_DIR`) y se sirven en `/media/<archivo>`.
La tabla guarda la URL pública, el tipo (`image`/`video`) y los metadatos.
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, id_pk


class UserMedia(Base, CreatedAtMixin):
    __tablename__ = "UserMedia"
    __table_args__ = (Index("ix_UserMedia_userId", "userId"),)

    id: Mapped[str] = id_pk()
    user_id: Mapped[str] = mapped_column(
        "userId",
        String(40),
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="image")
    filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Post al que quedó asociado el archivo (NULL si es avatar/portada).
    post_id: Mapped[str | None] = mapped_column("postId", String(40))

    user = relationship("User", back_populates="media", lazy="select")
