from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.utils.rate_limit import check_rate_limit
from app.utils.request import get_client_ip


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
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
        ],
    )
    # Rechaza peticiones con un Host no permitido (protección básica contra
    # DNS rebinding y hosts mal configurados).
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_hosts,
    )

    @app.middleware("http")
    async def application_firewall(request: Request, call_next):
        """Cortafuegos de aplicación: tamaño, rate limit y cabeceras seguras.

        No sustituye a un firewall/WAF de red. En producción conviene poner
        la API detrás de nginx, Cloudflare o el proxy del hosting.
        """
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                too_large = int(content_length) > settings.max_request_body_bytes
            except ValueError:
                too_large = True
            if too_large:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large"},
                )

        ip = get_client_ip(request)
        try:
            check_rate_limit(
                f"global:{ip}",
                limit=settings.global_rate_limit_per_minute,
                window_seconds=60,
            )
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault(
            "Cross-Origin-Resource-Policy", "same-site"
        )
        response.headers.setdefault(
            "X-Permitted-Cross-Domain-Policies", "none"
        )
        response.headers.setdefault("X-Download-Options", "noopen")
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")

        proto = request.headers.get(
            "x-forwarded-proto", request.url.scheme
        ).split(",")[0].strip()
        if proto == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )

        if request.url.path.startswith("/api/"):
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        if request.url.path.startswith("/api/v1/auth"):
            response.headers.setdefault("Cache-Control", "no-store")
            response.headers.setdefault("Pragma", "no-cache")

        return response

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/", tags=["infra"], include_in_schema=False)
    def root():
        return {"app": settings.app_name, "docs": "/docs"}

    return app


app = create_app()
