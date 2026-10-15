"""
Aísla la suite de la base de datos real.

settings/engine se crean al importar la app, y el lifespan (init_db, migraciones,
seeders) corre en cuanto un test usa `with TestClient(app)`. Por eso DATABASE_URL
se fija aquí, antes de importar nada de `app`/`main`, apuntando a un SQLite
temporal que se borra al terminar. Así ningún test toca elashes.db.
"""
import atexit
import os
import shutil
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="elashes-tests-")
atexit.register(shutil.rmtree, _tmp_dir, ignore_errors=True)

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(_tmp_dir, "test.db").replace("\\", "/")
# Evita que un .env/entorno local active rutas o claves de producción en los tests.
os.environ.pop("DB_HOST", None)
os.environ["CLIENT_NOTICES_ENABLED"] = "false"

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """El limitador de login/registro es global al proceso; sin esto los tests
    se bloquean entre sí (429) al compartir la misma IP de TestClient."""
    from app.core.rate_limit import _attempts

    _attempts.clear()
    yield
    _attempts.clear()
