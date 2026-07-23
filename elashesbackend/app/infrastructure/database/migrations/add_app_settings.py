"""
Migracion: configuracion global de la app (logo compartido entre usuarios).
Ejecutar con: python -m app.database.migrations.add_app_settings
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.infrastructure.database import engine


def _table_exists(conn, table_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(
            text("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = :table_name"),
            {"table_name": table_name},
        )
        return result.scalar() > 0

    result = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = :table_name
            """
        ),
        {"table_name": table_name},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        if _table_exists(conn, "app_settings", is_sqlite):
            print("La tabla app_settings ya existe.")
            return

        conn.execute(
            text(
                """
                CREATE TABLE app_settings (
                    id INTEGER PRIMARY KEY,
                    logo_url VARCHAR(500) NULL,
                    logo_original_name VARCHAR(255) NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO app_settings (id, logo_url, logo_original_name)
                VALUES (1, NULL, NULL)
                """
            )
        )
        conn.commit()
        print("Tabla app_settings creada.")


if __name__ == "__main__":
    upgrade()
