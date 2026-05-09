"""
Migracion: agrega columna opening_hours a branches para horarios dinamicos.
Ejecutar con: python -m app.database.migrations.add_branch_opening_hours
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
        if _column_exists(conn, "branches", "opening_hours", is_sqlite):
            print("La columna opening_hours ya existe en branches.")
            return

        if is_sqlite:
            conn.execute(text("ALTER TABLE branches ADD COLUMN opening_hours TEXT NULL"))
        else:
            conn.execute(text("ALTER TABLE branches ADD COLUMN opening_hours JSON NULL"))

        conn.commit()
        print("Columna opening_hours agregada a branches.")


if __name__ == "__main__":
    upgrade()
