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

    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:81"]

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

    # Cerebro de Pixel (GLM vía Z.ai, API compatible con OpenAI).
    # Sin clave el endpoint /buddy responde en modo demo.
    zai_api_key: str | None = None
    zai_model: str = "glm-4.5-flash"
    zai_base_url: str = "https://api.z.ai/api/paas/v4"


@lru_cache
def get_settings() -> Settings:
    return Settings()
