---
name: fastapi-testing
description: Testear este backend FastAPI con pytest + TestClient + SQLite en memoria. Cubre fixtures de cliente, override de `get_db`, semillas mínimas (rol + permisos), generación de `auth_headers`, y patrones para testear cada capa (service puro vs endpoint HTTP). Úsalo cuando el usuario pida crear tests, arreglar tests rotos, configurar pytest, o cuando trabajes con archivos en `tests/`.
---

# Testing del backend

## Stack

- `pytest` como runner.
- `fastapi.testclient.TestClient` para integration (HTTP).
- **SQLite en memoria** por test (rápido y aislado).
- Override de `get_db` con `app.dependency_overrides`.

## Setup recomendado: `tests/conftest.py`

Si todavía no existe, créalo con esta plantilla. Es el cimiento de todos los tests del proyecto:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.dependencies import get_db
from app.infrastructure.database import Base
from app.infrastructure.security import get_password_hash, create_access_token
from app.domain.entities.user import User, Role, Permission


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass  # la sesión vive durante todo el test

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def admin_user(db_session) -> User:
    """Crea un usuario con TODOS los permisos comunes."""
    permissions = [
        Permission(name=name) for name in [
            "branches:view", "branches:manage",
            "clients:view", "clients:manage",
            # añadir aquí los permisos que el test necesite
        ]
    ]
    role = Role(name="admin", permissions=permissions)
    user = User(
        username="admin_test",
        email="admin@test.local",
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(admin_user) -> dict[str, str]:
    token = create_access_token(subject=str(admin_user.id))
    return {"Authorization": f"Bearer {token}"}
```

> **Nota:** los nombres exactos de columnas en `User`, `Role`, `Permission` deben mirarse en [app/domain/entities/user.py](../../../app/domain/entities/user.py) — adáptalos si tu modelo difiere.

## Patrón 1: testear un endpoint (integration)

```python
def test_create_branch(client, auth_headers):
    resp = client.post(
        "/branches/",
        json={"name": "Sucursal Centro", "city": "La Paz"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Sucursal Centro"
    assert body["id"] > 0
```

Esto valida toda la cadena: route → controller → permiso → service → ORM → response_model.

## Patrón 2: testear un service puro (unit)

Cuando la lógica de negocio crece, no pases por HTTP:

```python
from app.application.services.branch_service import create_branch, list_branches

def test_list_branches_filters_by_city(db_session):
    create_branch(db=db_session, name="A", city="La Paz")
    create_branch(db=db_session, name="B", city="Cochabamba")
    result = list_branches(db=db_session, city="paz")
    assert [b.name for b in result] == ["A"]
```

Más rápido y más fácil de cubrir muchos casos.

## Patrón 3: testear 401 / 403

```python
def test_branches_requires_auth(client):
    resp = client.get("/branches/")
    assert resp.status_code == 401  # falta Authorization header


def test_branches_requires_permission(client, db_session):
    # Crear user sin el permiso branches:view
    role = Role(name="readonly", permissions=[])
    user = User(username="readonly", email="r@x.com",
                hashed_password=get_password_hash("x"),
                is_active=True, role=role)
    db_session.add(user); db_session.commit()
    token = create_access_token(subject=str(user.id))
    resp = client.get("/branches/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
```

## Reglas

1. **Un test = un escenario.** Si el nombre lleva un "and" considera partirlo.
2. **Cada test es independiente.** El fixture `db_session` recrea schema → no hay contaminación entre tests.
3. **Nombres descriptivos:** `test_<accion>_<condicion>_<resultado>`. Ej: `test_delete_branch_in_use_returns_409`.
4. **Arrange / Act / Assert** — separar visualmente con líneas en blanco.
5. **No mockear SQLAlchemy.** Es lento de mockear, frágil, y los tests reales con SQLite son rápidos. Mockear solo I/O externo (HTTP, email).
6. **Sobre `lifespan`:** `TestClient(app)` ejecuta el `lifespan` de `main.py` (incluyendo migraciones y seeders). Si eso ensucia el test, usa el fixture `db_session` y crea los datos que necesites en lugar de depender de los seeders.

## Correr los tests

```bash
pytest tests/ -v
pytest tests/test_branches.py -v
pytest tests/test_branches.py::test_create_branch -v
pytest -k "branch and create"            # por keyword
pytest --tb=short                        # tracebacks más cortos
```

Con coverage:
```bash
pytest --cov=app --cov-report=term-missing
```

## Anti-patrones a rechazar

- ❌ Tests que dependen del orden de ejecución.
- ❌ Tests que usan la BD real (`elashes.db`) — siempre SQLite en memoria.
- ❌ `sleep(...)` para esperar algo. Si necesitas esperar, hay un bug.
- ❌ Asserts sin mensaje cuando comparan `dict` grandes — añadir `assert resp.status_code == 200, resp.text` ayuda a debuggear.
- ❌ Fixtures con `scope="session"` que mutan estado — usar `scope="function"` por defecto.

## Skills relacionados

- [[fastapi-clean-architecture]] — cada capa se testea en su nivel.
- [[fastapi-auth-jwt]] — origen del `auth_headers` y los guards.
- [[fastapi-module-scaffold]] — la plantilla `test.py.tmpl` usa estos fixtures.
