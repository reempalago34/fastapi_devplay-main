from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "DevPlay API"
    app_env: str = "dev"  # dev | test | prod
    app_debug: bool = True

    # PostgreSQL local (peer auth por socket). Para Docker/TCP usar la variante
    # del .env.example: postgresql+psycopg://erick:pass@127.0.0.1:5433/devplay_api
    database_url: str = "postgresql+psycopg:///devplay_api?host=/var/run/postgresql"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:81", "http://localhost:8080", "http://127.0.0.1:8080"]

    # "Cortafuegos" de aplicación: hosts permitidos y límites básicos.
    # En producción añade tu dominio real (sin esquema ni puerto).
    trusted_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    # Actívalo solo si la API está detrás de un proxy de confianza (nginx,
    # Cloudflare, etc.). Si se activa sin proxy, se puede falsificar la IP.
    trust_proxy_headers: bool = False
    max_request_body_bytes: int = 10 * 1024 * 1024
    global_rate_limit_per_minute: int = 600

    # --- Subida de archivos (avatar, portada y galería) ---
    # Carpeta donde se guardan los archivos subidos. Se sirve en /uploads.
    uploads_dir: str = "uploads"
    # URL base pública para los archivos subidos.
    public_base_url: str = "http://127.0.0.1:8000"
    # Tamaño máximo por archivo (bytes). 8 MB.
    max_upload_bytes: int = 8 * 1024 * 1024
    # Formatos de imagen permitidos.
    allowed_image_types: list[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    ]
    # Formatos de video permitidos.
    allowed_video_types: list[str] = [
        "video/mp4",
        "video/webm",
    ]

    # SMTP (opcional). Sin configurar → modo demo: los códigos se registran en
    # el log y vuelven en `demoCode`, igual que devplay-main/src/lib/mailer.ts
    smtp_host: str | None = None
    smtp_port: int = 465
    smtp_user: str | None = None
    smtp_pass: str | None = None
    mail_from: str | None = None

    # Secreto compartido con el mini-servicio realtime (firma HMAC del handshake).
    # Si no se define, se usa jwt_secret.
    realtime_secret: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
