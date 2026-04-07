"""
Migracion: agrega columna sale_price_per_unit a batches.
Ejecutar con: python -m app.database.migrations.add_sale_price_to_batches
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

from sqlalchemy import text

from app.config.settings import settings
from app.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        column_exists = False
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(batches)"))
            for row in result:
                if row[1] == "sale_price_per_unit":
                    column_exists = True
                    break
        else:
            result = conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE() AND table_name = 'batches' AND column_name = 'sale_price_per_unit'
                    """
                )
            )
            column_exists = result.scalar() > 0

        if not column_exists:
            conn.execute(text("ALTER TABLE batches ADD COLUMN sale_price_per_unit FLOAT NULL"))
            conn.commit()
            print("Columna sale_price_per_unit agregada a batches.")
        else:
            print("La columna sale_price_per_unit ya existe en batches.")


if __name__ == "__main__":
    upgrade()
