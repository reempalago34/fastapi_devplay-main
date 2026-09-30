from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter(tags=["infra"])


@router.get("/health")
def health(response: Response, db: Session = Depends(get_db)):
    """Healthcheck para UptimeRobot / Coolify (equivalente a /api/health de Next)."""
    settings = get_settings()
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "error"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ok" if database == "ok" else "degraded",
        "app": settings.app_name,
        "env": settings.app_env,
        "database": database,
    }
