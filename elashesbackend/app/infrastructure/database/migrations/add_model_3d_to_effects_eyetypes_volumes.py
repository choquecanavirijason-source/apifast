"""
Migracion: agrega columnas model_3d_url y model_3d_filename a effects, eye_types y volumes.
Ejecutar con: python -m app.infrastructure.database.migrations.add_model_3d_to_effects_eyetypes_volumes
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


def _add_model_3d_columns(conn, table_name: str, is_sqlite: bool) -> None:
    if not _column_exists(conn, table_name, "model_3d_url", is_sqlite):
        col_type = "TEXT" if is_sqlite else "VARCHAR(500)"
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN model_3d_url {col_type} NULL"))
        conn.commit()
        print(f"Columna model_3d_url agregada a {table_name}.")

    if not _column_exists(conn, table_name, "model_3d_filename", is_sqlite):
        col_type = "TEXT" if is_sqlite else "VARCHAR(255)"
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN model_3d_filename {col_type} NULL"))
        conn.commit()
        print(f"Columna model_3d_filename agregada a {table_name}.")


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        for table_name in ("effects", "eye_types", "volumes"):
            _add_model_3d_columns(conn, table_name, is_sqlite)


if __name__ == "__main__":
    upgrade()
