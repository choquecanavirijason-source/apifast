"""
Migracion: convierte cash_closes (tabla que existia pero nunca se usó) en
una sesión real de apertura/cierre de caja — agrega status, quién y cuándo
abrió, y el monto inicial. Ver Salones → Caja → Apertura y Cierre.

La tabla original tenía closed_at como NOT NULL (tenía sentido cuando solo
existía "cerrar"), pero ahora una sesión recién abierta todavía no tiene
closed_at. SQLite no permite quitar NOT NULL con ALTER TABLE, así que esta
migración reconstruye la tabla completa — segura porque cash_closes nunca
tuvo un controlador real detrás (0 filas reales esperadas).

Ejecutar con: python -m app.infrastructure.database.migrations.add_cash_session_fields
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

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


def _closed_at_is_not_null(conn) -> bool:
    """PRAGMA table_info: columna índice 3 es el flag notnull (1 = NOT NULL)."""
    result = conn.execute(text("PRAGMA table_info(cash_closes)"))
    for row in result:
        if row[1] == "closed_at":
            return bool(row[3])
    return False


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        already_has_status = _column_exists(conn, "cash_closes", "status", is_sqlite)
        if already_has_status and (not is_sqlite or not _closed_at_is_not_null(conn)):
            return  # ya migrada correctamente

        if is_sqlite:
            row_count = conn.execute(text("SELECT COUNT(*) FROM cash_closes")).scalar()
            if row_count and row_count > 0:
                # Hay datos reales — no tocar automáticamente, requiere revisión manual.
                print(f"cash_closes tiene {row_count} filas — se salta la reconstrucción automática.")
                return

            conn.execute(text("ALTER TABLE cash_closes RENAME TO cash_closes_old"))
            conn.execute(text("""
                CREATE TABLE cash_closes (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    date              VARCHAR(10)  NOT NULL,
                    branch_id         INTEGER      REFERENCES branches(id) ON DELETE SET NULL,
                    status            VARCHAR(10)  NOT NULL DEFAULT 'open',
                    opened_by_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
                    opened_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    opening_amount    REAL,
                    closed_by_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
                    closed_at         DATETIME,
                    grand_total       FLOAT        NOT NULL DEFAULT 0.0,
                    grand_commission  FLOAT        NOT NULL DEFAULT 0.0,
                    total_paid        FLOAT        NOT NULL DEFAULT 0.0,
                    total_unpaid      FLOAT        NOT NULL DEFAULT 0.0,
                    notes             TEXT
                )
            """))
            conn.execute(text("DROP TABLE cash_closes_old"))
            conn.commit()
            print("Tabla cash_closes reconstruida con soporte de apertura/cierre.")
        else:
            conn.execute(text("ALTER TABLE cash_closes ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'closed'"))
            conn.execute(text("ALTER TABLE cash_closes ADD COLUMN opened_by_id INT NULL"))
            conn.execute(text("ALTER TABLE cash_closes ADD COLUMN opened_at DATETIME NULL"))
            conn.execute(text("ALTER TABLE cash_closes ADD COLUMN opening_amount DOUBLE NULL"))
            conn.execute(text("ALTER TABLE cash_closes MODIFY closed_at DATETIME NULL"))
            conn.commit()
            print("Columnas de apertura/cierre agregadas a cash_closes.")


if __name__ == "__main__":
    upgrade()
