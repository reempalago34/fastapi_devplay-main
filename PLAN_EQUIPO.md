# Plan de trabajo — DevPlay API (FastAPI)

> Documento para coordinar el trabajo en equipo sobre `fastapi_devplay-main`.
> Fecha de inicio: 30/09/2026 · Estado: **Fase 0 (base) lista**

---

## 1. Objetivo

Reescribir la API de `devplay-main` (Next.js + Prisma, 51 endpoints) en
**FastAPI + SQLAlchemy 2.0**, manteniendo:

- los **mismos 22 modelos** y nombres de tablas/columnas,
- la misma lógica de negocio y validaciones (Zod → Pydantic),
- la misma estructura de endpoints bajo `/api/v1`.

La base (Fase 0) ya está hecha: estructura, modelos, JWT, health y auth.
A partir de aquí cada dominio avanza por separado.

## 2. Decisiones ya tomadas (no se renegocian por rama)

| Tema | Decisión |
|---|---|
| ORM | SQLAlchemy 2.0 tipado + Alembic |
| BD | Postgres **nueva** `devplay_api` (separada de la de Next.js) |
| Auth | JWT Bearer: access 30 min + refresh 7 días, bcrypt |
| Validación | Pydantic v2 (`422` en errores, igual que Zod) |
| Nombres en BD | camelCase, idénticos a `prisma/schema.prisma` |
| Tests | pytest contra `devplay_api_test` (nunca contra dev) |
| Puerto | 8000 (`/docs` para el Swagger) |

## 3. Reparto por dominios y modelos

### Erick — Identidad, usuarios y seguridad

| Fase | Modelos | Endpoints a crear |
|---|---|---|
| M1 | `Block`, `Report`, `LoginEvent`, `AccountDeletionCode` | `security/block`, `security/block/list`, `security/report`, `security/password`, `security/privacy`, `security/login-events`, `security/account` |
| M2 | `Follow` | `follow` (GET/POST/DELETE), `users/[id]`, `users/[id]/followers`, `users/[id]/following`, `users/by-username/[username]`, `users/me/stats`, `users/me/achievements`, `users/me/bookmarks` |
| M3 | `StoreItem`, `StorePurchase`, `DevCoinTransaction` | `store/items`, `store/buy`, `store/balance`, `store/my-items` |

Además — **Erick ✅ Hecho**: registro con código de 6 dígitos (`LoginCode` +
SMTP o modo demo con `demoCode`), `verify-register`, `forgot-password` /
`reset-password`, `auth/guest` y `realtime-token` (HMAC, 30 min).

### Compañero — Contenido, juegos y directos

| Fase | Modelos | Endpoints a crear |
|---|---|---|
| M1 | `Post`, `Comment`, `Like`, `Bookmark` | `posts` (GET/POST), `posts/[id]` (GET/PATCH/DELETE), `posts/[id]/comments`, `posts/[id]/likes`, `posts/[id]/bookmarks`, `posts/[id]/repost` |
| M2 | `Beta`, `Poll`, `PollOption`, `PollVote` | `betas/[id]/edit`, `betas/[id]/download`, `posts/[id]/poll`, creación de encuestas dentro de `POST /posts` |
| M2 | `Stream` | `streams`, `streams/go-live`, `streams/go-offline` |
| M3 | `Notification`, `ChatMessage`, `DirectMessage` | `notifications`, `chat`, `dm`, `dm/[userId]` |

### Fase 4 (juntos)

`discover`, `search`, `buddy` (asistente IA) y la conexión con el frontend
Next.js + servicio realtime.

**Regla:** si necesitas un modelo o endpoint de la otra persona, lo pides por
*issue* antes de tocar su archivo.

## 4. Ramas

```
main          ← siempre funciona: pytest en verde + uvicorn arranca
└── develop   ← integración diaria
     ├── feature/auth-codes              (Erick · M1)
     ├── feature/security-moderation     (Erick · M1)
     ├── feature/users-follow            (Erick · M2)
     ├── feature/store-devcoins          (Erick · M3)
     ├── feature/content-feed            (Compañero · M1)
     ├── feature/betas-polls             (Compañero · M2)
     ├── feature/streams                 (Compañero · M2)
     └── feature/chat-dm-notifications   (Compañero · M3)
```

### Flujo por tarea

1. `git checkout develop && git pull`
2. `git checkout -b feature/<dominio>` desde `develop`
3. Desarrollas + escribes tests en la misma rama
4. Pull Request → `develop` con el checklist de la §6
5. Review del otro (mínimo 1 aprobación) y merge
6. Ramas se borran tras el merge · ninguna rama vive **>3 días**

## 5. Reglas anti-conflicto (obligatorias)

1. **Un archivo por dominio**: `app/models/<dominio>.py`,
   `app/schemas/<dominio>.py`, `app/api/v1/<dominio>.py`,
   `app/services/<dominio>_service.py`. Nunca editan el archivo del otro.
2. `app/api/v1/router.py` y `app/main.py` solo se agregan **1 línea** por
   feature. Si hay conflicto, lo resuelve quien mergea.
3. Migraciones Alembic con el prefijo del autor:
   `er_auth_codes`, `jd_content_feed` (`alembic revision -m "<prefijo>_<tema>"`).
   **Nunca** editar ni reordenar una revisión ya mergeada.
4. Los modelos de la Fase 0 ya están; si necesitas añadir un campo, lo hablas
   y quien lo creó hace el cambio + migración.
5. Nada de `print()` de depuración: usar `logging` (`logger = logging.getLogger(__name__)`).
6. Los secretos van en `.env` (gitignored). Jamás en el código.

## 6. Definition of Done (checklist del PR)

- [ ] Endpoint documentado con `summary`/`tags` en OpenAPI
- [ ] Validación con Pydantic (devuelve `422` con `detail`)
- [ ] Auth correcta: `Depends(get_current_user)` en escrituras
- [ ] Rate limit en endpoints sensibles (`check_rate_limit`)
- [ ] Tests nuevos en `tests/test_<dominio>.py` y **pytest en verde**
- [ ] Migración incluida si se tocó un modelo (`alembic upgrade head` funciona)
- [ ] `ruff check app tests` sin errores
- [ ] Nada de secretos ni datos personales en el código

## 7. Hitos

| Hito | Contenido | Responsable | Estado |
|---|---|---|---|
| **M0** | Base: estructura, 22 modelos, JWT, health, auth, tests | Erick | ✅ Hecho |
| **M1** | Seguridad/moderación **‖** Feed (posts/likes/comentarios) | Erick ‖ Compañero | Erick ✅ / Compañero ⬜ |
| **M2** | Users/follow/stats **‖** Betas/polls/streams | Erick ‖ Compañero | Erick ✅ / Compañero ⬜ |
| **M3** | Tienda DevCoins **‖** Chat/DM/notificaciones | Erick ‖ Compañero | Erick ✅ / Compañero ⬜ |
| **M4** | discover/search/buddy + integración con Next.js y realtime | Juntos | ⬜ |

## 8. Ritmo de trabajo

- **Lunes (15 min):** qué hace cada uno esta semana, ramas nuevas.
- **Viernes (demo):** cada uno muestra su endpoint funcionando; se mergea a
  `develop` aunque falte pulir (siempre en verde).
- Cualquier bloqueo se avanza **el mismo día** por el canal del proyecto.

## 9. Cómo arrancar el entorno

```bash
cd fastapi_devplay-main
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
./scripts/dev-db.sh start     # postgres de desarrollo en :55432 (sin sudo)
alembic upgrade head
uvicorn app.main:app --reload        # Swagger en http://localhost:8000/docs
pytest                               # debe quedar en verde antes de empezar
```

## 10. Endpoints ya implementados (Fase 0 — plantilla a replicar)

| Método | Ruta | Qué muestra |
|---|---|---|
| GET | `/api/v1/health` | Healthcheck con prueba de BD |
| POST | `/api/v1/auth/register` | Validación + rate limit + manejo de duplicados |
| POST | `/api/v1/auth/login` | Auth + escritura de `LoginEvent` + anti-enumeración |
| POST | `/api/v1/auth/refresh` | Manejo de tokens |
| GET | `/api/v1/auth/me` | Dependency de auth (`get_current_user`) |
| GET/PATCH | `/api/v1/users/me[/profile]` | Lectura y escritura con Pydantic |

> Copia el patrón de `app/api/v1/auth.py` + `app/schemas/auth.py` +
> `app/services/auth_service.py` para tu dominio.
