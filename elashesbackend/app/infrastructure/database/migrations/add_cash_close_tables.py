"""Migration: crea tablas cash_closes y commission_receipts para el cierre de caja."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def _table_exists(conn, table_name: str, is_sqlite: bool) -> bool:
    if is_sqlite:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
            {"t": table_name},
        )
        return result.fetchone() is not None
    else:
        result = conn.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema=DATABASE() AND table_name=:t"
            ),
            {"t": table_name},
        )
        return (result.scalar() or 0) > 0


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")

    with engine.connect() as conn:
        # ── cash_closes ────────────────────────────────────────────────────
        if not _table_exists(conn, "cash_closes", is_sqlite):
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE cash_closes (
                        id            INTEGER PRIMARY KEY AUTOINCREMENT,
                        date          VARCHAR(10)  NOT NULL,
                        branch_id     INTEGER      REFERENCES branches(id) ON DELETE SET NULL,
                        closed_by_id  INTEGER      REFERENCES users(id)    ON DELETE SET NULL,
                        closed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        grand_total   FLOAT        NOT NULL DEFAULT 0.0,
                        grand_commission FLOAT     NOT NULL DEFAULT 0.0,
                        total_paid    FLOAT        NOT NULL DEFAULT 0.0,
                        total_unpaid  FLOAT        NOT NULL DEFAULT 0.0,
                        notes         TEXT
                    )
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE cash_closes (
                        id            INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        date          VARCHAR(10)   NOT NULL,
                        branch_id     INT           DEFAULT NULL,
                        closed_by_id  INT           DEFAULT NULL,
                        closed_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        grand_total   DOUBLE        NOT NULL DEFAULT 0.0,
                        grand_commission DOUBLE     NOT NULL DEFAULT 0.0,
                        total_paid    DOUBLE        NOT NULL DEFAULT 0.0,
                        total_unpaid  DOUBLE        NOT NULL DEFAULT 0.0,
                        notes         TEXT,
                        FOREIGN KEY (branch_id)    REFERENCES branches(id) ON DELETE SET NULL,
                        FOREIGN KEY (closed_by_id) REFERENCES users(id)    ON DELETE SET NULL
                    )
                """))
            conn.commit()
            print("Tabla cash_closes creada.")
        else:
            print("Tabla cash_closes ya existe.")

        # ── commission_receipts ────────────────────────────────────────────
        if not _table_exists(conn, "commission_receipts", is_sqlite):
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE commission_receipts (
                        id                INTEGER PRIMARY KEY AUTOINCREMENT,
                        date              VARCHAR(10)  NOT NULL,
                        branch_id         INTEGER      REFERENCES branches(id) ON DELETE SET NULL,
                        professional_id   INTEGER      REFERENCES users(id)    ON DELETE SET NULL,
                        professional_name VARCHAR(100) NOT NULL,
                        amount            FLOAT        NOT NULL DEFAULT 0.0,
                        confirmed_by_id   INTEGER      REFERENCES users(id)    ON DELETE SET NULL,
                        confirmed_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE commission_receipts (
                        id                INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        date              VARCHAR(10)  NOT NULL,
                        branch_id         INT          DEFAULT NULL,
                        professional_id   INT          DEFAULT NULL,
                        professional_name VARCHAR(100) NOT NULL,
                        amount            DOUBLE       NOT NULL DEFAULT 0.0,
                        confirmed_by_id   INT          DEFAULT NULL,
                        confirmed_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (branch_id)       REFERENCES branches(id) ON DELETE SET NULL,
                        FOREIGN KEY (professional_id) REFERENCES users(id)    ON DELETE SET NULL,
                        FOREIGN KEY (confirmed_by_id) REFERENCES users(id)    ON DELETE SET NULL
                    )
                """))
            conn.commit()
            print("Tabla commission_receipts creada.")
        else:
            print("Tabla commission_receipts ya existe.")


if __name__ == "__main__":
    upgrade()
