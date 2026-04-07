"""
Migracion: agrega columna image_url a service_categories.
Ejecutar con: python -m app.database.migrations.add_image_url_to_service_categories
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.database import engine


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
        if _column_exists(conn, "service_categories", "image_url", is_sqlite):
            return

        if is_sqlite:
            conn.execute(text("ALTER TABLE service_categories ADD COLUMN image_url TEXT NULL"))
        else:
            conn.execute(text("ALTER TABLE service_categories ADD COLUMN image_url VARCHAR(5000) NULL"))
        conn.commit()
        print("Columna image_url agregada a service_categories.")


if __name__ == "__main__":
    upgrade()
