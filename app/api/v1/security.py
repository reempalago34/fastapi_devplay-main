from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.security import (
    AccountAction,
    AccountCodeResponse,
    BlockListResponse,
    BlockRequest,
    BlockResponse,
    LoginEventsResponse,
    OkResponse,
    PasswordChangeRequest,
    PrivacyRequest,
    PrivacyResponse,
    ReportRequest,
)
from app.services import security_service as svc

router = APIRouter(prefix="/security", tags=["security"])


@router.post("/block", response_model=BlockResponse)
def block_user(
    payload: BlockRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bloquea a un usuario y elimina el seguimiento mutuo."""
    svc.block_user(db, user.id, payload.blocked_id)
    return BlockResponse(blocked=True)


@router.delete("/block", response_model=BlockResponse)
def unblock_user(
    blocked_id: str = Query(alias="blockedId", min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc.unblock_user(db, user.id, blocked_id)
    return BlockResponse(blocked=False)


@router.get("/block/list", response_model=BlockListResponse)
def list_blocked(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BlockListResponse(blocked=svc.list_blocked(db, user.id))


@router.post("/report", response_model=OkResponse)
def report(
    payload: ReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reporta un POST/USER/COMMENT/BETA (máx. 5 por minuto)."""
    svc.create_report(db, user.id, payload)
    return OkResponse()


@router.patch("/privacy", response_model=PrivacyResponse)
def patch_privacy(
    payload: PrivacyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc.set_privacy(db, user, payload.is_private)
    return PrivacyResponse(ok=True, isPrivate=payload.is_private)


@router.post("/password", response_model=OkResponse)
def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc.change_password(db, user, payload)
    return OkResponse()


@router.get("/login-events", response_model=LoginEventsResponse)
def login_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return LoginEventsResponse(events=svc.list_login_events(db, user))


@router.post("/account", response_model=AccountCodeResponse | OkResponse)
def delete_account(
    payload: AccountAction,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Borrado de cuenta en 3 pasos: request-code → verify-code → confirm."""
    if payload.action == "request-code":
        return AccountCodeResponse(**svc.request_deletion_code(db, user))
    if payload.action == "verify-code":
        svc.verify_deletion_code(db, user.id, payload.code)
        return OkResponse()
    svc.confirm_deletion(db, user, payload.code, payload.password, payload.confirm)
    return OkResponse()
