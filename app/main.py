from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "API REST de DevPlay. Reescritura en FastAPI de devplay-main "
            "(Next.js + Prisma)."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api/v1")

    # Archivos subidos por el usuario (avatar, portada, galería). El cliente
    # recibe la URL absoluta y la usa directamente en <img>/<video>.
    media_root = Path(settings.media_dir).resolve()
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.media_url_prefix,
        StaticFiles(directory=media_root),
        name="media",
    )

    @app.get("/", tags=["infra"], include_in_schema=False)
    def root():
        return {"app": settings.app_name, "docs": "/docs"}

    return app


app = create_app()
