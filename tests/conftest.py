"""Fixtures globales.

Los tests NUNCA tocan la BD de desarrollo: derivan el nombre de la base
(`X` → `X_test`) a partir del DATABASE_URL real, así funcionan igual en local,
en Docker o en el Postgres del compañero.
"""

import os

from sqlalchemy.engine import make_url

from app.core.config import get_settings

_dev_url = make_url(get_settings().database_url)
os.environ["DATABASE_URL"] = _dev_url.set(database=f"{_dev_url.database}_test").render_as_string(
    hide_password=False
)
get_settings.cache_clear()

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(scope="session")
def database():
    """Crea las tablas una vez por sesión de tests y las borra al terminar."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_rate_limits():
    """El rate limit vive en memoria compartida entre tests: se limpia en cada uno."""
    from app.utils.rate_limit import _hits

    _hits.clear()
    yield
    _hits.clear()


@pytest.fixture()
def db(database):
    """Sesión de SQLAlchemy dedicada para sembrar datos desde los tests."""
    with SessionLocal() as session:
        yield session


@pytest.fixture()
def client(database):
    with TestClient(app) as test_client:
        yield test_client
