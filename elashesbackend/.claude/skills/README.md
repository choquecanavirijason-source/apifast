# Skills del Backend FastAPI (elashesbackend)

Esta carpeta contiene **skills personalizados** que Claude Code carga automáticamente cuando trabajas en este proyecto. Cada subcarpeta es un skill con su `SKILL.md` y, opcionalmente, plantillas / código de referencia.

## Skills incluidos

| Skill | Cuándo se activa | Resumen |
|-------|------------------|---------|
| [fastapi-clean-architecture](./fastapi-clean-architecture/SKILL.md) | Diseño, refactors, decisiones arquitectónicas | Capas Domain / Application / Infrastructure / Presentation con dependencias hacia adentro |
| [fastapi-module-scaffold](./fastapi-module-scaffold/SKILL.md) | Crear un módulo nuevo (`branch`, `client`, `pos_sale`...) | Plantillas de model + schema + repository + service + controller + route + tests |
| [fastapi-auth-jwt](./fastapi-auth-jwt/SKILL.md) | Login, registro, roles, permisos | JWT con `python-jose`, hashing `bcrypt`, dependencias `require_permission` |
| [fastapi-testing](./fastapi-testing/SKILL.md) | Crear o ejecutar tests | `pytest` + `TestClient`, SQLite en memoria, fixtures, override de dependencias |

## Referencia viva

La carpeta [reference/branch_clean/](./reference/branch_clean/) contiene el módulo `branch` migrado a Clean Architecture **como ejemplo no productivo**. Sirve para que veas en código cómo aplican los skills al repositorio real. **No se importa desde `main.py`** — el código de producción sigue siendo el de `app/`.

## Cómo trabaja Claude Code con esto

1. Cuando abres una conversación en este repo, los skills se listan en el contexto.
2. Cuando pides algo que coincide con la `description` de un skill (ej. *"crea el módulo de proveedores"*), Claude invoca el skill correspondiente y aplica sus reglas.
3. Las plantillas en `templates/` son texto plano con marcadores `{{Module}}`, `{{module}}`, `{{modules}}` que Claude sustituye al generar archivos nuevos.

## Convenciones del proyecto

- **Python 3.10+**, FastAPI, SQLAlchemy 2.0, Pydantic v2.
- Estructura en capas Clean Architecture:
  - `app/domain/entities/` — entidades SQLAlchemy
  - `app/domain/exceptions/` — excepciones de dominio
  - `app/application/services/` — casos de uso
  - `app/infrastructure/database/` — session, base, migraciones, seeders
  - `app/infrastructure/repositories/` — repositorios de acceso a datos
  - `app/infrastructure/security/` — JWT + password hashing
  - `app/presentation/controllers/` — APIRouters por feature
  - `app/presentation/routes/` — routers transversales (auth, admin)
  - `app/presentation/schemas/` — DTOs Pydantic
  - `app/core/dependencies.py` — get_db, require_permission, etc.
  - `app/config/settings.py` — settings
- Las rutas se registran en [main.py](../../main.py) dentro de `create_app()`.
- Permisos por endpoint con `Depends(require_permission("recurso:accion"))`.
- Respuestas de error consistentes vía `HTTPException` o el handler global en `main.py`.

## Para añadir un skill nuevo

Crea una carpeta `nombre-skill/` con un `SKILL.md` que arranque con frontmatter:

```yaml
---
name: nombre-skill
description: Cuándo usar este skill. Sé específico — esta línea decide si Claude lo invoca.
---
```

Y debajo, las instrucciones que quieres que Claude siga.
