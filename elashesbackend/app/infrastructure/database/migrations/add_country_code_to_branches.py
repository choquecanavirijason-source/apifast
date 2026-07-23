"""
Migracion: agrega columna country_code a branches, con backfill automatico
derivado del valor actual de department (que hoy guarda el NOMBRE del pais,
segun el selector "Pais" del admin web). Sucursales cuyo department no
matchea ningun nombre conocido quedan con country_code NULL (no se asigna
un pais al azar) para poder detectarlas y corregirlas desde el admin.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine

# Mismo listado de paises que adminElashes/src/pages/admin/salons/utils.ts
# (COUNTRY_CITY_OPTIONS) — mantenerlos sincronizados si se agregan paises ahi.
COUNTRY_NAME_TO_CODE = {
    "bolivia": "BO",
    "argentina": "AR",
    "chile": "CL",
    "peru": "PE",
    "paraguay": "PY",
    "uruguay": "UY",
    "brasil": "BR",
    "colombia": "CO",
    "ecuador": "EC",
    "venezuela": "VE",
    "mexico": "MX",
    "estados unidos": "US",
    "canada": "CA",
    "espana": "ES",
    "francia": "FR",
    "italia": "IT",
    "alemania": "DE",
    "reino unido": "GB",
    "portugal": "PT",
    "japon": "JP",
}


def _column_exists(conn, table_name: str, column_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return any(row[1] == column_name for row in result)
    result = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if _column_exists(conn, "branches", "country_code", is_sqlite):
            print("La columna country_code ya existe en branches.")
            return

        conn.execute(text("ALTER TABLE branches ADD COLUMN country_code VARCHAR(2) NULL"))
        conn.commit()

        rows = conn.execute(text("SELECT id, department FROM branches")).fetchall()
        updated = 0
        for row in rows:
            department = (row[1] or "").strip().lower()
            code = COUNTRY_NAME_TO_CODE.get(department)
            if code:
                conn.execute(
                    text("UPDATE branches SET country_code = :code WHERE id = :id"),
                    {"code": code, "id": row[0]},
                )
                updated += 1
        conn.commit()
        print(f"Columna country_code agregada a branches. Backfill: {updated}/{len(rows)} sucursales.")


if __name__ == "__main__":
    upgrade()
