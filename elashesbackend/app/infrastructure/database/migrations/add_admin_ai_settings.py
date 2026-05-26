"""
Migracion: configuracion global de IA para el panel admin.
Ejecutar con: python -m app.database.migrations.add_admin_ai_settings
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
        if _table_exists(conn, "admin_ai_settings", is_sqlite):
            print("La tabla admin_ai_settings ya existe.")
            return

        conn.execute(
            text(
                """
                CREATE TABLE admin_ai_settings (
                    id INTEGER PRIMARY KEY,
                    ai_enabled BOOLEAN NOT NULL DEFAULT 0,
                    ai_api_url VARCHAR(500) NULL,
                    ai_api_token TEXT NULL,
                    ai_model VARCHAR(120) NOT NULL DEFAULT 'gpt-4o-mini'
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO admin_ai_settings (id, ai_enabled, ai_api_url, ai_api_token, ai_model)
                VALUES (1, 0, NULL, NULL, 'gpt-4o-mini')
                """
            )
        )
        conn.commit()
        print("Tabla admin_ai_settings creada.")


if __name__ == "__main__":
    upgrade()
