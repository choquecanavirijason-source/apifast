"""
Migracion: crea categorias para servicios y agrega category_id en services.
Ejecutar con: python -m app.database.migrations.add_service_categories
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.database import engine


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


def _constraint_exists(conn, table_name: str, constraint_name: str) -> bool:
    result = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = DATABASE() AND table_name = :table_name AND constraint_name = :constraint_name
            """
        ),
        {"table_name": table_name, "constraint_name": constraint_name},
    )
    return result.scalar() > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        if not _table_exists(conn, "service_categories", is_sqlite):
            conn.execute(
                text(
                    """
                    CREATE TABLE service_categories (
                        id INTEGER PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE,
                        description VARCHAR(255) NULL
                    )
                    """
                )
            )
            conn.commit()
            print("Tabla service_categories creada.")

        conn.execute(
            text(
                """
                INSERT INTO service_categories (name, description)
                SELECT :name, :description
                WHERE NOT EXISTS (
                    SELECT 1 FROM service_categories WHERE name = :name
                )
                """
            ),
            {
                "name": "General",
                "description": "Categoria por defecto para servicios",
            },
        )
        conn.commit()

        if not _column_exists(conn, "services", "category_id", is_sqlite):
            conn.execute(text("ALTER TABLE services ADD COLUMN category_id INTEGER NULL"))
            conn.commit()
            print("Columna category_id agregada a services.")

        default_category_id = conn.execute(
            text("SELECT id FROM service_categories WHERE name = :name LIMIT 1"),
            {"name": "General"},
        ).scalar()

        conn.execute(
            text(
                """
                UPDATE services
                SET category_id = :default_category_id
                WHERE category_id IS NULL
                """
            ),
            {"default_category_id": default_category_id},
        )
        conn.commit()

        if not is_sqlite and not _constraint_exists(conn, "services", "fk_services_category_id"):
            conn.execute(
                text(
                    """
                    ALTER TABLE services
                    ADD CONSTRAINT fk_services_category_id
                    FOREIGN KEY (category_id) REFERENCES service_categories(id)
                    """
                )
            )
            conn.commit()
            print("Foreign key fk_services_category_id creada.")


if __name__ == "__main__":
    upgrade()
