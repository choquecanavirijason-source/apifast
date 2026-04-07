"""
Migracion: agrega tabla pos_sales y columnas de auditoria para tickets/pagos.
Ejecutar con: python -m app.database.migrations.add_pos_sales_and_ticket_audit
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
        if not _table_exists(conn, "pos_sales", is_sqlite):
            conn.execute(
                text(
                    """
                    CREATE TABLE pos_sales (
                        id INTEGER PRIMARY KEY,
                        sale_code VARCHAR(50) NOT NULL UNIQUE,
                        client_id INTEGER NOT NULL,
                        branch_id INTEGER NULL,
                        created_by_id INTEGER NULL,
                        subtotal FLOAT NOT NULL DEFAULT 0,
                        discount_type VARCHAR(20) NOT NULL DEFAULT 'amount',
                        discount_value FLOAT NOT NULL DEFAULT 0,
                        total FLOAT NOT NULL DEFAULT 0,
                        payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
                        status VARCHAR(30) NOT NULL DEFAULT 'paid',
                        notes TEXT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(client_id) REFERENCES clients(id),
                        FOREIGN KEY(branch_id) REFERENCES branches(id),
                        FOREIGN KEY(created_by_id) REFERENCES users(id)
                    )
                    """
                )
            )
            conn.commit()
            print("Tabla pos_sales creada.")

        for table_name, column_name, definition in [
            ("appointments", "created_by_id", "INTEGER NULL REFERENCES users(id)"),
            ("appointments", "sale_id", "INTEGER NULL REFERENCES pos_sales(id)"),
            ("payments", "sale_id", "INTEGER NULL REFERENCES pos_sales(id)"),
        ]:
            if not _column_exists(conn, table_name, column_name, is_sqlite):
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))
                conn.commit()
                print(f"Columna {column_name} agregada a {table_name}.")
            else:
                print(f"La columna {column_name} ya existe en {table_name}.")


if __name__ == "__main__":
    upgrade()
