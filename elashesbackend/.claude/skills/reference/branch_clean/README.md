# Módulo `branch` — referencia Clean Architecture

> **No es código productivo.** Esto vive bajo `.claude/skills/reference/` y **no se importa desde `main.py`**. El módulo real sigue siendo el de `app/`. Esta carpeta sirve como **plantilla copiable** y muestra cómo aplicar [[fastapi-clean-architecture]] a un módulo existente.

## Cambios vs. el módulo original

| Original (`app/services/branch_service.py`)                       | Refactor (`./service.py`)                                |
|-------------------------------------------------------------------|----------------------------------------------------------|
| Una función con muchas responsabilidades (validación + ORM + commit + side-effects) | Cada use case es una función nombrada y pequeña          |
| Acceso a SQLAlchemy mezclado con reglas de negocio                | `BranchRepository` aísla todo el acceso a datos          |
| Migración `_ensure_opening_hours_column` dentro del service       | Eliminada — las migraciones van en `app/database/migrations/` |
| `HTTPException` lanzada directamente desde el service             | Excepciones de dominio (`BranchNotFound`, `BranchNameConflict`) traducidas a HTTP en el controller |
| Variable global `_opening_hours_column_checked`                   | Eliminada — el service es stateless                      |
| Helpers privados (`_attach_branch_user_ids`, `_sync_branch_users`) acoplados al estado del request | Movidos al repository o al service según su naturaleza |

## Estructura

```
reference/branch_clean/
├── README.md                  # este archivo
├── domain/
│   ├── entities.py            # entidad pura (no SQLAlchemy)
│   └── exceptions.py          # BranchNotFound, BranchNameConflict
├── infrastructure/
│   └── repository.py          # BranchRepository (SQLAlchemy)
├── application/
│   └── service.py             # casos de uso, recibe el repo, no la sesión
├── presentation/
│   ├── schemas.py             # DTOs Pydantic
│   └── controller.py          # APIRouter, traduce excepciones a HTTP
└── tests/
    └── test_branch.py         # tests por capa
```

## Cómo aplicar esto a un módulo del repo real

Opción A — **gradual y de bajo riesgo (recomendado):**
1. Extrae el acceso a datos a `app/database/<modulo>_repository.py`.
2. Quita los `db.query(...)` del service y reemplázalos por llamadas al repo.
3. Deja las `HTTPException` en el service (es lo que hoy hace el resto del repo) — solo migra a excepciones de dominio si vas a aplicar el patrón en TODO el repo.

Opción B — **full Clean Arch** (lo que muestra esta referencia):
4. Crea `app/<modulo>/domain/`, `application/`, `infrastructure/`, `presentation/`. Cuidado: si lo haces para un solo módulo y el resto del repo sigue plano, el código diverge y confunde. Aplica esto solo si **vas a refactorizar todo el repo**.

## Dependencias entre capas (la regla de oro)

```
presentation/controller.py  →  application/service.py
                                       │
                                       ▼
                          infrastructure/repository.py
                                       │
                                       ▼
                              domain/entities.py
                              domain/exceptions.py
```

- `domain/` no importa nada de los otros tres.
- `infrastructure/` puede importar de `domain/`.
- `application/` puede importar de `domain/` (y depende de `infrastructure/` vía inyección).
- `presentation/` puede importar de los tres.

## Skills relacionados

- [[fastapi-clean-architecture]] — la teoría detrás de esta organización.
- [[fastapi-module-scaffold]] — el scaffold para crear módulos así desde cero.
- [[fastapi-testing]] — los fixtures que usan los tests aquí.
