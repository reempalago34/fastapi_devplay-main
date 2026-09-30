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

from app.core.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture(scope="session")
def database():
    """Crea las tablas una vez por sesión de tests y las borra al terminar."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(database):
    with TestClient(app) as test_client:
        yield test_client
