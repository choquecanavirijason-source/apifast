"""
Ejemplo de cómo se testea cada capa por separado.

NO se ejecuta como parte de la suite del proyecto — vive bajo
`.claude/skills/reference/` y depende de fixtures que tendrías que crear
en `tests/conftest.py` (ver [[fastapi-testing]]).
"""
import pytest

from ..domain.entities import Branch, DaySchedule, TimeRange
from ..domain.exceptions import BranchNotFound, BranchNameConflict
from ..application.service import BranchService


# --- 1. Tests de dominio: puros, sin BD ---

def test_time_range_invalid():
    with pytest.raises(ValueError):
        TimeRange(open_time="18:00", close_time="09:00")


def test_branch_entity_rename_rejects_empty():
    b = Branch(id=1, name="Centro")
    with pytest.raises(ValueError):
        b.rename("  ")


# --- 2. Tests de service: con repo en memoria ---

class InMemoryBranchRepo:
    """Fake repo para tests unitarios del service. No toca SQLAlchemy."""
    def __init__(self):
        self._store: dict[int, object] = {}
        self._seq = 0

    def list(self, *, skip=0, limit=100, city=None, department=None):
        items = list(self._store.values())
        if city: items = [b for b in items if (b.city or "").lower().find(city.lower()) >= 0]
        if department: items = [b for b in items if (b.department or "").lower().find(department.lower()) >= 0]
        return items[skip:skip+limit]

    def get_by_id(self, branch_id):
        return self._store.get(branch_id)

    def get_by_name(self, name, *, exclude_id=None):
        for b in self._store.values():
            if b.name == name.strip() and b.id != exclude_id:
                return b
        return None

    def find_users(self, user_ids):
        return [], list(user_ids)  # no users in this fake

    def add(self, branch):
        self._seq += 1
        branch.id = self._seq
        branch.users = []
        if not hasattr(branch, "opening_hours") or branch.opening_hours is None:
            branch.opening_hours = []
        self._store[branch.id] = branch
        return branch

    def delete(self, branch):
        self._store.pop(branch.id, None)

    def reassign_users(self, branch_id, users):
        pass

    def commit(self): pass
    def rollback(self): pass
    def refresh(self, branch): pass


def test_service_create_then_get():
    svc = BranchService(repo=InMemoryBranchRepo())
    created = svc.create_branch(name="Centro", city="La Paz")
    fetched = svc.get_branch(created.id)
    assert fetched.name == "Centro"


def test_service_get_missing_raises_domain_exception():
    svc = BranchService(repo=InMemoryBranchRepo())
    with pytest.raises(BranchNotFound):
        svc.get_branch(999)


def test_service_duplicate_name_raises_conflict():
    svc = BranchService(repo=InMemoryBranchRepo())
    svc.create_branch(name="Centro")
    with pytest.raises(BranchNameConflict):
        svc.create_branch(name="Centro")


# --- 3. Tests de presentación: vía TestClient ---
# Ver tests/conftest.py del proyecto principal para los fixtures
# `client` y `auth_headers`. Esta sección es ilustrativa.

def test_create_branch_endpoint_returns_201(client, auth_headers):
    resp = client.post(
        "/branches/",
        json={"name": "Sucursal Clean"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Sucursal Clean"


def test_get_missing_branch_returns_404(client, auth_headers):
    resp = client.get("/branches/9999", headers=auth_headers)
    assert resp.status_code == 404
