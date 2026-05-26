---
name: fastapi-clean-architecture
description: Aplicar Clean Architecture en este backend FastAPI organizado por capas. Cubre la regla de dependencias hacia adentro, casos de uso, puertos/adaptadores y la estructura real del repo (domain / application / infrastructure / presentation). Úsalo cuando el usuario pida diseñar un módulo nuevo, refactorizar uno existente, decidir dónde poner una pieza de código, o mejorar la separación de responsabilidades. Si la duda es "esto va en service o en controller", o "cómo desacoplo X de SQLAlchemy", invoca este skill.
---

# Clean Architecture en FastAPI

## Objetivo

Mantener el código **organizado por responsabilidad** y con **dependencias en una sola dirección** (hacia adentro). El dominio no sabe nada de FastAPI ni de SQLAlchemy; la infraestructura sí conoce al dominio.

```
            ┌─────────────────────────────────────────────┐
            │  Presentation  (FastAPI routes/controllers)  │
            └──────────────────────┬──────────────────────┘
                                   │ usa
            ┌──────────────────────▼──────────────────────┐
            │  Application  (use cases / services)         │
            └──────────────────────┬──────────────────────┘
                                   │ usa (puertos)
            ┌──────────────────────▼──────────────────────┐
            │  Domain  (entidades, value objects)          │
            └──────────────────────▲──────────────────────┘
                                   │ implementa
            ┌──────────────────────┴──────────────────────┐
            │  Infrastructure  (repos, ORM, HTTP, ext)     │
            └─────────────────────────────────────────────┘
```

**Regla de oro:** la flecha siempre apunta hacia el dominio. Una capa puede importar de capas internas; **nunca al revés**.

## Estructura real del repo

```
app/
├── domain/
│   ├── entities/          # SQLAlchemy models (Branch, Client, User, ...)
│   └── exceptions/        # excepciones de dominio (vacío por ahora)
├── application/
│   └── services/          # casos de uso (branch_service.py, ...)
├── infrastructure/
│   ├── database/          # session, base_class, seeders, init_db, migrations/
│   ├── repositories/      # repositorios con acceso SQLAlchemy (item_repository.py, ...)
│   └── security/          # jwt.py, password.py
├── presentation/
│   ├── controllers/       # APIRouters por feature
│   ├── routes/            # auth_routes.py, admin.py (routers transversales)
│   └── schemas/           # DTOs Pydantic
├── core/
│   └── dependencies.py    # get_db, require_permission, get_current_user
├── config/
│   └── settings.py        # carga .env
└── exceptions.py          # excepciones HTTP globales
```

## Mapeo capa ↔ carpeta

| Capa Clean Arch         | Carpeta                                  | Qué va aquí                                                           |
|-------------------------|------------------------------------------|-----------------------------------------------------------------------|
| Domain                  | `app/domain/entities/`                   | Entidades persistentes (SQLAlchemy). Reglas de dominio puras.         |
| Domain (excepciones)    | `app/domain/exceptions/`                 | Excepciones agnósticas de transporte (NotFound, Conflict, ...).        |
| Application             | `app/application/services/`              | Casos de uso. Orquesta repos + reglas. No toca `Request`/`Response`.  |
| Infrastructure (DB)     | `app/infrastructure/database/`           | Engine, Session, Base, migraciones, seeders.                           |
| Infrastructure (repos)  | `app/infrastructure/repositories/`       | Acceso a datos vía SQLAlchemy.                                         |
| Infrastructure (auth)   | `app/infrastructure/security/`           | `jwt.py` (emisión/decode), `password.py` (bcrypt).                     |
| Presentation (handlers) | `app/presentation/controllers/`          | Definen `APIRouter`, validan permisos, llaman al service.             |
| Presentation (rutas)    | `app/presentation/routes/`               | Agregadores transversales (auth, admin).                              |
| Presentation (DTOs)     | `app/presentation/schemas/`              | Pydantic v2 request/response. **Nunca** se devuelven modelos ORM.     |
| Cross-cutting           | `app/core/dependencies.py`               | `get_db`, `require_permission`, `get_current_user`.                   |
| Composition root        | `app/config/settings.py` + `main.py`     | Settings, lectura `.env`, registro de routers, lifespan.              |

## Las cuatro capas en detalle

### 1. Domain — `app/domain/`
- **`entities/`**: SQLAlchemy models. Por pragmatismo el ORM vive aquí. Si una regla de dominio crece, extráela a una función pura en el mismo archivo o cerca del service.
- **`exceptions/`**: clases como `BranchNotFound(DomainError)` que el service lanza y el controller traduce a HTTP. (Por ahora vacío — añade aquí cuando crezca la necesidad).

### 2. Application — `app/application/services/`
- Cada función exportada de un service = **un caso de uso**.
- Recibe primitivas o DTOs, devuelve entidad o DTO.
- Orquesta: validaciones de negocio + repos + commits.
- **Hoy lanza `HTTPException`** (pragmático). Idealmente lanzaría excepciones de dominio y un handler global las traduce.

```python
def create_branch(db: Session, name: str, ...) -> Branch:
    existing = db.query(Branch).filter(Branch.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe")
    branch = Branch(name=name, ...)
    db.add(branch); db.commit(); db.refresh(branch)
    return branch
```

### 3. Infrastructure — `app/infrastructure/`
- **`database/`**: configuración SQLAlchemy, sesión, base, seeders, migraciones.
- **`repositories/`**: queries reutilizables encapsuladas. Crea uno solo cuando la query se repite o crece. Para queries triviales (`db.query(X).filter(...).first()`), déjalo inline en el service.
- **`security/`**: `jwt.py` (`create_access_token`, `decode_token`) + `password.py` (`get_password_hash`, `verify_password`). Re-exportados vía `from app.infrastructure.security import ...`.

### 4. Presentation — `app/presentation/`
- **`controllers/`**: define `APIRouter` con prefix + tags. Cada endpoint hace exactamente esto:
  1. Recibe el `payload: Schema` validado por Pydantic.
  2. Resuelve dependencias (`db`, `current_user`).
  3. Llama al service con primitivas.
  4. Devuelve la entidad/DTO con `response_model`.
- **`routes/`**: routers transversales (login, admin) que no encajan en un feature.
- **`schemas/`**: DTOs Pydantic — los Response usan `model_config = ConfigDict(from_attributes=True)`.

**No metas lógica de negocio en el controller.**

## Reglas que Claude debe seguir

1. **Una función de service = un caso de uso.** Nombres en imperativo: `create_branch`, `list_branches`, `assign_users_to_branch`.
2. **El controller es plano.** Si ves un `if` con lógica de negocio en un controller, muévelo al service.
3. **El service no conoce HTTP.** Recibe `db: Session` y primitivas. Devuelve entidad o `dict`. No usa `Request`/`Response`.
4. **Las entidades nunca se devuelven directamente al cliente.** Siempre vía `response_model` (Pydantic) con `model_config = ConfigDict(from_attributes=True)`.
5. **Las dependencias compartidas viven en `app/core/dependencies.py`.** No duplicar `get_db` ni `require_permission` en cada controller.
6. **Los permisos se aplican en el controller**, vía `Depends(require_permission("recurso:accion"))`. El service asume que ya está autorizado.
7. **Imports siguen la regla de dependencias:**
   - `presentation/controllers` puede importar de `application/services`, `presentation/schemas`, `core`, `domain/entities`.
   - `application/services` puede importar de `domain/entities`, `infrastructure/repositories`, `infrastructure/security`.
   - `domain/*` y `presentation/schemas` **no** importan de `application/services` ni `presentation/controllers`.
8. **Registrar rutas en [main.py](../../../main.py) dentro de `create_app()`.** No olvidar este paso al crear un módulo nuevo — es el error más común.

## Cuándo extraer un repositorio

Crea `app/infrastructure/repositories/<modelo>_repository.py` cuando:
- La misma query aparece en 2+ services.
- La query crece más de 5 líneas (joins, filtros opcionales, agregaciones).
- Necesitas mockearla en tests sin tocar SQLAlchemy real.

Si solo es `db.query(Branch).filter(...).first()`, déjalo inline en el service.

## Anti-patrones a rechazar

- ❌ `db: Session = Depends(get_db)` dentro de una función de service. La sesión la inyecta el controller y se la pasa al service.
- ❌ Pydantic schemas con métodos que llaman a la BD. Los schemas son DTOs puros.
- ❌ Controllers que arman queries SQLAlchemy directamente.
- ❌ Imports circulares — síntoma de capas mezcladas. Refactoriza moviendo la pieza compartida a `core/` o `infrastructure/`.
- ❌ Devolver `branch.__dict__` o el modelo ORM crudo. Usa `response_model`.
- ❌ Lógica de migración dentro del service de runtime (como `_ensure_opening_hours_column`). Las migraciones van en `app/infrastructure/database/migrations/`.
- ❌ Importar de la ubicación vieja: `from app.models.X` ya no existe — usa `from app.domain.entities.X`. Mismo para `app.schemas`, `app.services`, `app.controllers`, `app.routes`, `app.database`, `app.core.security`.

## Tabla de migración de imports (de la estructura vieja a la nueva)

| Import viejo (no usar)              | Import nuevo                                       |
|-------------------------------------|----------------------------------------------------|
| `from app.models.X import ...`      | `from app.domain.entities.X import ...`            |
| `from app.schemas.X import ...`     | `from app.presentation.schemas.X import ...`       |
| `from app.services.X import ...`    | `from app.application.services.X import ...`       |
| `from app.controllers.X import ...` | `from app.presentation.controllers.X import ...`   |
| `from app.routes.X import ...`      | `from app.presentation.routes.X import ...`        |
| `from app.database import Base, engine` | `from app.infrastructure.database import Base, engine` |
| `from app.database.session import ...` | `from app.infrastructure.database.session import ...` |
| `from app.database.seeders import ...` | `from app.infrastructure.database.seeders import ...` |
| `from app.database.migrations.X import ...` | `from app.infrastructure.database.migrations.X import ...` |
| `from app.database.item_repository import ...` | `from app.infrastructure.repositories.item_repository import ...` |
| `from app.core.security import ...` | `from app.infrastructure.security import ...`      |
| `from app.core.dependencies import ...` | (sin cambios)                                  |
| `from app.config.settings import ...` | (sin cambios)                                 |

## Ejemplo vivo

Ver [reference/branch_clean/](../reference/branch_clean/) — el módulo `branch` reescrito con un nivel adicional de pureza (entidades puras + repositorio inyectado + excepciones de dominio). Es **referencia copiable**, no productivo. La estructura del repo real es la layered de arriba.

## Skills relacionados

- [[fastapi-module-scaffold]] — para crear un módulo entero desde cero respetando estas capas.
- [[fastapi-auth-jwt]] — para el flujo de autenticación con `app/infrastructure/security/`.
- [[fastapi-testing]] — para testear cada capa por separado.
