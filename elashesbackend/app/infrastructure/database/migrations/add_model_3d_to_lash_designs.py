"""
Migracion: agrega columnas model_3d_url y model_3d_filename a lash_designs.
Ejecutar con: python -m app.infrastructure.database.migrations.add_model_3d_to_lash_designs
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine


def _column_exists(conn, table_name: str, column_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return any(row[1] == column_name for row in result)

    result = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        if not _column_exists(conn, "lash_designs", "model_3d_url", is_sqlite):
            if is_sqlite:
                conn.execute(text("ALTER TABLE lash_designs ADD COLUMN model_3d_url TEXT NULL"))
            else:
                conn.execute(text("ALTER TABLE lash_designs ADD COLUMN model_3d_url VARCHAR(500) NULL"))
            conn.commit()
            print("Columna model_3d_url agregada a lash_designs.")

        if not _column_exists(conn, "lash_designs", "model_3d_filename", is_sqlite):
            if is_sqlite:
                conn.execute(text("ALTER TABLE lash_designs ADD COLUMN model_3d_filename TEXT NULL"))
            else:
                conn.execute(text("ALTER TABLE lash_designs ADD COLUMN model_3d_filename VARCHAR(255) NULL"))
            conn.commit()
            print("Columna model_3d_filename agregada a lash_designs.")


if __name__ == "__main__":
    upgrade()
