"""
Migración: agrega columnas ci y marketplace_enabled a clients
"""
from sqlalchemy import text
from app.config.settings import settings
from app.infrastructure.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if is_sqlite:
            existing = [row[1] for row in conn.execute(text("PRAGMA table_info(clients)"))]
            if "ci" not in existing:
                conn.execute(text("ALTER TABLE clients ADD COLUMN ci VARCHAR(20) NULL"))
                print("Columna ci agregada a clients.")
            if "marketplace_enabled" not in existing:
                conn.execute(text("ALTER TABLE clients ADD COLUMN marketplace_enabled BOOLEAN NOT NULL DEFAULT 0"))
                print("Columna marketplace_enabled agregada a clients.")
            conn.commit()
        else:
            def col_exists(col: str) -> bool:
                r = conn.execute(text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE() AND table_name = 'clients' AND column_name = :col
                """), {"col": col})
                return r.scalar() > 0

            if not col_exists("ci"):
                conn.execute(text("ALTER TABLE clients ADD COLUMN ci VARCHAR(20) NULL"))
                conn.commit()
                print("Columna ci agregada a clients.")
            if not col_exists("marketplace_enabled"):
                conn.execute(text("ALTER TABLE clients ADD COLUMN marketplace_enabled BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                print("Columna marketplace_enabled agregada a clients.")
