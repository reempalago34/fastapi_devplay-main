# DevPlay API (FastAPI)

Reescritura en **FastAPI + SQLAlchemy 2.0 + PostgreSQL** de la API de
[`devplay-main`](../devplay-main) (Next.js + Prisma). Mismos modelos, mismos
nombres de tablas y columnas (camelCase) para que los datos sean intercambiables
entre las dos aplicaciones.

## Stack

| Capa | Tecnología |
|---|---|
| Web framework | FastAPI + Uvicorn |
| ORM | SQLAlchemy 2.0 (tipado `Mapped[]`) |
| Migraciones | Alembic |
| Schemas/validación | Pydantic v2 |
| Auth | JWT (access 30 min + refresh 7 días) + bcrypt |
| BD | PostgreSQL 16 |

## Arranque rápido

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env          # revisar DATABASE_URL y JWT_SECRET

./scripts/dev-db.sh start     # Postgres propio en :55432 + crea las 2 bases
alembic upgrade head          # crea las 22 tablas
uvicorn app.main:app --reload
```

Docs interactivas: <http://localhost:8000/docs>

### Con Docker

```bash
docker compose up --build     # api en :8000, postgres en :5433
```

## Endpoints de la base (Fase 0)

| Método | RPath | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/health` | — | Healthcheck + prueba de BD |
| POST | `/api/v1/auth/register` | — | Registro (5/min por IP) |
| POST | `/api/v1/auth/login` | — | Login JWT (10/min por IP) + `LoginEvent` |
| POST | `/api/v1/auth/refresh` | refresh token | Renueva el access token |
| GET | `/api/v1/auth/me` | Bearer | Usuario actual |
| GET | `/api/v1/users/me` | Bearer | Perfil completo |
| PATCH | `/api/v1/users/me/profile` | Bearer | Actualiza perfil |

## Tests

```bash
pytest            # usa devplay_api_test, nunca la BD de desarrollo
ruff check app tests
```

## Estructura

```
app/
├── main.py            # create_app(): CORS + routers
├── core/              # config, database, security (JWT/bcrypt), deps, enums
├── models/            # 1 archivo por dominio (22 modelos, igual que Prisma)
├── schemas/           # Pydantic v2 por dominio
├── api/v1/            # 1 router por dominio + router.py (punto de integración)
├── services/          # lógica de negocio
└── utils/             # rate-limit, JSON fields, request helpers
alembic/               # migraciones (versions/)
tests/                 # pytest
```

## Convención de trabajo en equipo

Ver **[PLAN_EQUIPO.md](PLAN_EQUIPO.md)**: reparto por dominios, ramas,
reglas anti-conflicto y Definition of Done.
