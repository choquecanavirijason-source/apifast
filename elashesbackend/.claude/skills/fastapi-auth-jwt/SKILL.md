---
name: fastapi-auth-jwt
description: Autenticación y autorización en este backend FastAPI con JWT, bcrypt y roles/permisos. Cubre login, hashing de password, decodificación de tokens, dependencias para extraer el usuario actual, y los guards `require_role` / `require_permission`. Úsalo cuando el usuario pida añadir login, registrar usuarios, proteger endpoints, agregar roles o permisos nuevos, o debugear "401/403". También cuando trabajes con `app/core/security.py`, `app/core/dependencies.py`, `app/routes/auth_routes.py` o `app/services/auth_service.py`.
---

# Auth con JWT, bcrypt y permisos

## Stack ya implementado en el repo

| Pieza               | Archivo                                                    |
|---------------------|------------------------------------------------------------|
| Hash de passwords   | [app/infrastructure/security/password.py](../../../app/infrastructure/security/password.py) (passlib + bcrypt) |
| Emisión / decode JWT | [app/infrastructure/security/jwt.py](../../../app/infrastructure/security/jwt.py) (python-jose) |
| Re-exports unificados | [app/infrastructure/security/__init__.py](../../../app/infrastructure/security/__init__.py) — importa todo desde aquí |
| Dependency `get_current_user` | [app/core/dependencies.py](../../../app/core/dependencies.py) |
| Guards de rol/permiso | `require_role`, `require_any_role`, `require_permission`, `require_any_permission` |
| Endpoints de login  | [app/presentation/routes/auth_routes.py](../../../app/presentation/routes/auth_routes.py) |
| Entidades `User`/`Role`/`Permission` | [app/domain/entities/user.py](../../../app/domain/entities/user.py) |
| Seeders de roles    | [app/infrastructure/database/seeders.py](../../../app/infrastructure/database/seeders.py) |

**No reinventar.** Reusar estas piezas siempre.

## Flujo de login (cómo se ve la cosa)

```
Cliente                       /auth/login                     /auth/me
  │  POST username+password      │                                │
  ├─────────────────────────────►│                                │
  │                              │ verify_password (bcrypt)       │
  │                              │ create_access_token(sub=user.id)│
  │  200 { access_token }        │                                │
  │◄─────────────────────────────┤                                │
  │                                                               │
  │  GET /branches/  Authorization: Bearer <token>                │
  ├──────────────────────────────────────────────────────────────►│
  │                              decode_token → user_id           │
  │                              get_current_user → User          │
  │                              require_permission(...)          │
  │  200 [...]                                                    │
  │◄──────────────────────────────────────────────────────────────┤
```

## Reglas

### Proteger un endpoint

```python
from app.core.dependencies import require_permission
from app.domain.entities.user import User

@router.get("/", response_model=List[XResponse])
def list_x(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("x:view")),
):
    ...
```

- **GET / list / detail** → `"<recurso>:view"`
- **POST / PUT / DELETE** → `"<recurso>:manage"`
- Si el endpoint solo lo puede hacer un superadmin → `Depends(require_role("admin"))`.
- Si necesitas "puede X **o** Y" → `require_any_permission("x:view", "x:manage")`.

### Crear un permiso nuevo

1. Añadir el string `"recurso:accion"` al endpoint con `require_permission(...)`.
2. Añadirlo a [app/database/seeders.py](../../../app/database/seeders.py) (sección de permisos y asignación a roles).
3. Re-correr seeders (al arrancar la app o vía `app/database/run_seeders_cli.py`).

### Crear / hashear passwords

**Nunca** guardar password en claro. Siempre:

```python
from app.infrastructure.security import get_password_hash, verify_password

user.hashed_password = get_password_hash(plain_password)  # al crear
verify_password(plain_password, user.hashed_password)     # al login
```

### Emitir un token manualmente (caso raro)

```python
from datetime import timedelta
from app.infrastructure.security import create_access_token

token = create_access_token(
    subject=str(user.id),                  # ← siempre string
    expires_delta=timedelta(hours=8),      # opcional
)
```

`subject` siempre es `str(user.id)` — `decode_token` luego hace `int(sub)`.

### Refresh tokens (no implementado, recomendación)

Si el usuario pide refresh tokens:
1. Crear modelo `RefreshToken(id, user_id, token_hash, expires_at, revoked)`.
2. Añadir endpoint `POST /auth/refresh` que verifique el refresh, lo rote, y emita un nuevo access token corto (15 min).
3. Guardar el **hash** del refresh token, no el token en claro.
4. Endpoint `POST /auth/logout` que revoque el refresh activo.

No agregues refresh tokens sin que el usuario lo pida — la app es local (Tauri) y un access token de larga duración suele ser suficiente.

## Anti-patrones a rechazar

- ❌ `current_user = Depends(get_current_user)` cuando el endpoint requiere permiso. Siempre que se requiera autorización, usar `require_permission` (también valida que esté activo).
- ❌ Guardar `secret_key` en código. Vive en `.env` y lo carga `settings.secret_key`.
- ❌ Devolver `User` con `hashed_password` al cliente. Filtrar siempre con un schema `UserResponse` que no incluya el hash.
- ❌ `algorithm="HS256"` hardcodeado en cada llamada — usar `settings.algorithm`.
- ❌ Tokens sin `exp` — siempre setear expiración.
- ❌ Endpoints públicos sin `current_user` en módulos que sí necesitan auth — Claude debe asumir auth obligatoria salvo que el usuario diga "este es público".

## Debugging 401 / 403

| Síntoma                                        | Causa más común                                    |
|-----------------------------------------------|----------------------------------------------------|
| 401 "No se pudo validar las credenciales"     | Token vencido o malformado. `decode_token` lanzó `JWTError`. |
| 403 "Usuario inactivo"                        | `user.is_active = False`.                          |
| 403 "El usuario no tiene rol asignado"        | El user no tiene `role_id`.                        |
| 403 "Se requiere el permiso: x:y"             | Falta seed del permiso o no está asignado al rol del user. Revisar [app/infrastructure/database/seeders.py](../../../app/infrastructure/database/seeders.py). |
| 401 al instante en Swagger                    | `OAuth2PasswordBearer(tokenUrl="/auth/login")` — usar el botón "Authorize" de Swagger. |

## Skills relacionados

- [[fastapi-clean-architecture]] — el guard va en el controller, no en el service.
- [[fastapi-testing]] — cómo generar un `auth_headers` fixture para tests.
