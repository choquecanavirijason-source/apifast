"""
Migracion: perfiles de API (WhatsApp / IA) por sucursal o compartidos entre varias.
Ejecutar con: python -m app.database.migrations.add_branch_integration_profiles
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
        if not _table_exists(conn, "branch_integration_profiles", is_sqlite):
            conn.execute(
                text(
                    """
                    CREATE TABLE branch_integration_profiles (
                        id INTEGER PRIMARY KEY,
                        name VARCHAR(120) NOT NULL,
                        is_shared BOOLEAN NOT NULL DEFAULT 1,
                        whatsapp_enabled BOOLEAN NOT NULL DEFAULT 0,
                        whatsapp_provider VARCHAR(30) NOT NULL DEFAULT 'webhook',
                        whatsapp_api_url VARCHAR(500) NULL,
                        whatsapp_api_token TEXT NULL,
                        whatsapp_phone_number_id VARCHAR(120) NULL,
                        ai_api_url VARCHAR(500) NULL,
                        ai_api_token TEXT NULL
                    )
                    """
                )
            )
            conn.commit()
            print("Tabla branch_integration_profiles creada.")

        if not _column_exists(conn, "branches", "integration_profile_id", is_sqlite):
            conn.execute(
                text(
                    "ALTER TABLE branches ADD COLUMN integration_profile_id INTEGER NULL "
                    "REFERENCES branch_integration_profiles(id)"
                )
            )
            conn.commit()
            print("Columna integration_profile_id agregada a branches.")


if __name__ == "__main__":
    upgrade()
