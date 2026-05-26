---
name: fastapi-module-scaffold
description: Crear un módulo CRUD completo en este backend FastAPI siguiendo Clean Architecture en capas (domain / application / infrastructure / presentation). Genera entity + schema + repository (si aplica) + service + controller + registro de ruta + test mínimo. Úsalo cuando el usuario diga "crea el módulo X", "necesito un CRUD de X", "scaffold para X", "añade endpoints para X". Sigue las plantillas en `templates/` de esta carpeta.
---

# Scaffold de un módulo FastAPI

Este skill genera **todos los archivos** necesarios para un módulo nuevo en este repo, respetando la arquitectura por capas existente.

## Proceso paso a paso

Cuando el usuario pide un módulo nuevo (ej. `supplier` / `Supplier` / `suppliers`):

1. **Confirmar los nombres y campos** con `AskUserQuestion` si el usuario no los dio:
   - Singular PascalCase (`Supplier`)
   - Singular snake_case (`supplier`)
   - Plural snake_case (`suppliers`) — tabla y prefijo de ruta
   - Lista de campos con tipo y si son nullable
   - Si requiere autenticación / qué permisos
2. **Verificar** que el módulo no exista ya (`Glob app/domain/entities/<nombre>.py`).
3. **Generar archivos** usando las plantillas de [templates/](./templates/) (sustituye `{{Module}}`, `{{module}}`, `{{modules}}` y los placeholders de campos).
4. **Registrar la ruta** editando [main.py](../../../main.py): añadir el import desde `app.presentation.controllers` y el `app.include_router(...)` dentro de `create_app()`.
5. **Avisar al usuario** qué se creó y qué pasos manuales quedan (migración, permisos en seeders, tests).

## Archivos que genera el scaffold

Para un módulo `{{module}}`, ubicados en la arquitectura por capas:

```
app/
├── domain/entities/{{module}}.py                      # entidad SQLAlchemy
├── presentation/schemas/{{module}}.py                 # DTOs Pydantic (Create, Update, Response)
├── application/services/{{module}}_service.py         # casos de uso (list, get, create, update, delete)
├── presentation/controllers/{{module}}_controller.py  # APIRouter con endpoints
└── infrastructure/repositories/{{module}}_repository.py  # OPCIONAL — solo si hay queries complejas

tests/
└── test_{{module}}.py                                 # smoke test mínimo

# Y se edita:
main.py                                                # +import +include_router
```

## Reglas (de [[fastapi-clean-architecture]])

- El service recibe `db: Session` + primitivas, **no** schemas Pydantic ni `Request`.
- El controller llama al service así: `create_{{module}}(db=db, name=payload.name, ...)`.
- Permisos: `Depends(require_permission("{{modules}}:view"))` para GET, `"{{modules}}:manage"` para POST/PUT/DELETE.
- Validar unicidad por algún campo natural (p.ej. `name`) — devolver `409 CONFLICT`.
- Manejar `IntegrityError` en `delete` y devolver `409` si el recurso está en uso.

## Cuándo crear el repository

**No crear** un archivo `_repository.py` si todas las queries son one-liners (`db.query(X).filter(...).first()`). Déjalo inline en el service.

**Crear** un repository en `app/infrastructure/repositories/` cuando:
- Hay 3+ funciones que repiten joins/filtros.
- Hay queries con `joinedload`, agregaciones, o ventanas que ensucian el service.
- Quieres mockear acceso a datos en tests sin tocar SQLAlchemy.

Plantilla en [templates/repository.py.tmpl](./templates/repository.py.tmpl).

## Post-scaffold: TODO manual

Después de generar, recordar al usuario:

1. **Migración** — si la entidad añade tablas o columnas nuevas:
   - Crear archivo en `app/infrastructure/database/migrations/add_{{module}}_table.py`
   - Importarlo en [main.py](../../../main.py) (sección de imports explícitos `m1..mN`) y añadirlo al loop de `migrations`
2. **Permisos en seeders** — registrar `"{{modules}}:view"` y `"{{modules}}:manage"` en [app/infrastructure/database/seeders.py](../../../app/infrastructure/database/seeders.py) si el proyecto usa seeding de permisos por rol.
3. **Tests** — completar `tests/test_{{module}}.py` (ver [[fastapi-testing]]).
4. **Documentación** — añadir endpoints al `API_DOCUMENTATION.md` si el proyecto lo mantiene.

## Plantillas disponibles

| Plantilla | Destino |
|-----------|---------|
| [model.py.tmpl](./templates/model.py.tmpl) | `app/domain/entities/{{module}}.py` |
| [schema.py.tmpl](./templates/schema.py.tmpl) | `app/presentation/schemas/{{module}}.py` |
| [service.py.tmpl](./templates/service.py.tmpl) | `app/application/services/{{module}}_service.py` |
| [controller.py.tmpl](./templates/controller.py.tmpl) | `app/presentation/controllers/{{module}}_controller.py` |
| [repository.py.tmpl](./templates/repository.py.tmpl) | `app/infrastructure/repositories/{{module}}_repository.py` (opcional) |
| [test.py.tmpl](./templates/test.py.tmpl) | `tests/test_{{module}}.py` |

## Skills relacionados

- [[fastapi-clean-architecture]] — la arquitectura por capas que respeta este scaffold.
- [[fastapi-testing]] — para el test mínimo y cómo extenderlo.
- [[fastapi-auth-jwt]] — para los permisos `require_permission`.
