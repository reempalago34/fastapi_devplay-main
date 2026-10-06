from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.posts import _serialize_many
from app.core.database import get_db
from app.core.deps import get_optional_user
from app.models.user import User
from app.schemas.discovery import DiscoverOut
from app.services import discovery_service as svc

router = APIRouter(tags=["discover"])


@router.get("/discover", response_model=DiscoverOut, summary="Agregado de la pantalla Descubrir")
def discover(
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    """Las cinco secciones de Descubrir en una sola llamada: trending,
    devs recomendados, betas populares, tags populares y lo más reciente.
    Nada de quien tengas bloqueado (ni quien te bloquee a ti)."""
    viewer_id = viewer.id if viewer else None

    trending = svc.trending_posts(db, viewer_id)
    recommended = svc.recommended_users(db, viewer_id)
    betas = svc.popular_betas(db, viewer_id)
    tags = svc.popular_tags(db)
    recent = svc.recent_posts(db, viewer_id)

    return DiscoverOut(
        trending=_serialize_many(db, trending, viewer_id),
        recommended_users=recommended,
        popular_betas=betas,
        popular_tags=tags,
        recent=_serialize_many(db, recent, viewer_id),
    )
