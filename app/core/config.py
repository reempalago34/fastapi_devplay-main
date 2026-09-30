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


@lru_cache
def get_settings() -> Settings:
    return Settings()
