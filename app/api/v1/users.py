from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import ProfileUpdateRequest
from app.schemas.user import UserMe
from app.services.auth_service import update_profile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMe)
def read_my_profile(user: User = Depends(get_current_user)):
    return user


@router.patch("/me/profile", response_model=UserMe)
def patch_my_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Plantilla de endpoint de escritura: valida con Pydantic → muta → devuelve."""
    return update_profile(db, user, payload)
