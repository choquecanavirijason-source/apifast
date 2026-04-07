"""
Migracion: agrega sucursal a clientes, vinculos de servicios por sucursal,
servicios multiples por ticket y tracking enlazado a ticket/sucursal.
Ejecutar con: python -m app.database.migrations.add_branch_client_and_service_links
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


def _table_is_empty(conn, table_name: str) -> bool:
    result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
    return result.scalar() == 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        if not _column_exists(conn, "clients", "branch_id", is_sqlite):
            conn.execute(text("ALTER TABLE clients ADD COLUMN branch_id INTEGER NULL"))
            conn.commit()
            print("Columna branch_id agregada a clients.")

        if not _table_exists(conn, "branch_services", is_sqlite):
            conn.execute(
                text(
                    """
                    CREATE TABLE branch_services (
                        id INTEGER PRIMARY KEY,
                        branch_id INTEGER NOT NULL,
                        service_id INTEGER NOT NULL,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        FOREIGN KEY(branch_id) REFERENCES branches(id),
                        FOREIGN KEY(service_id) REFERENCES services(id)
                    )
                    """
                )
            )
            conn.commit()
            print("Tabla branch_services creada.")

        if not _table_exists(conn, "appointment_services", is_sqlite):
            conn.execute(
                text(
                    """
                    CREATE TABLE appointment_services (
                        id INTEGER PRIMARY KEY,
                        appointment_id INTEGER NOT NULL,
                        service_id INTEGER NOT NULL,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        FOREIGN KEY(appointment_id) REFERENCES appointments(id),
                        FOREIGN KEY(service_id) REFERENCES services(id)
                    )
                    """
                )
            )
            conn.commit()
            print("Tabla appointment_services creada.")

        if not _column_exists(conn, "client_tracking", "appointment_id", is_sqlite):
            conn.execute(text("ALTER TABLE client_tracking ADD COLUMN appointment_id INTEGER NULL"))
            conn.commit()
            print("Columna appointment_id agregada a client_tracking.")

        if not _column_exists(conn, "client_tracking", "branch_id", is_sqlite):
            conn.execute(text("ALTER TABLE client_tracking ADD COLUMN branch_id INTEGER NULL"))
            conn.commit()
            print("Columna branch_id agregada a client_tracking.")

        if _table_exists(conn, "appointment_services", is_sqlite) and _table_is_empty(conn, "appointment_services"):
            conn.execute(
                text(
                    """
                    INSERT INTO appointment_services (appointment_id, service_id, sort_order)
                    SELECT id, service_id, 0
                    FROM appointments
                    WHERE service_id IS NOT NULL
                    """
                )
            )
            conn.commit()
            print("Servicios existentes copiados a appointment_services.")

        if _table_exists(conn, "branch_services", is_sqlite) and _table_is_empty(conn, "branch_services"):
            conn.execute(
                text(
                    """
                    INSERT INTO branch_services (branch_id, service_id, is_active)
                    SELECT b.id, s.id, 1
                    FROM branches b
                    CROSS JOIN services s
                    """
                )
            )
            conn.commit()
            print("Servicios asignados a todas las sucursales.")


if __name__ == "__main__":
    upgrade()
