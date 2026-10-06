from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.posts import _serialize_many
from app.core.database import get_db
from app.core.deps import get_optional_user
from app.models.user import User
from app.schemas.discovery import SearchOut
from app.services import discovery_service as svc

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchOut, summary="Busca usuarios y posts")
def search(
    q: str = Query("", description="Texto a buscar; con menos de 2 caracteres devuelve vacío"),
    limit_users: int = Query(10, ge=1, le=50),
    limit_posts: int = Query(15, ge=1, le=50),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    """Buscador del header: usuarios (no invitados) por username/nombre/bio y
    posts por contenido o por el título/descripción de su beta. Ignora
    mayúsculas y excluye a quien tengas bloqueado."""
    query = q.strip()
    if len(query) < 2:
        return SearchOut(q=query)

    viewer_id = viewer.id if viewer else None
    users = svc.search_users(db, query, viewer_id, limit=limit_users)
    posts = svc.search_posts(db, query, viewer_id, limit=limit_posts)
    return SearchOut(q=query, users=users, posts=_serialize_many(db, posts, viewer_id))
