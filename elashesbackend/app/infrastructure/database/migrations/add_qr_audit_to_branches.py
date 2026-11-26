"""
Migracion: el QR de pago pasa a subirse como imagen y se audita quién lo cambió.

- qr_image_url: en MySQL pasa a MEDIUMTEXT (guarda la imagen como data URL; TEXT, con
  64 KB, no alcanza). En Postgres/SQLite TEXT ya no tiene ese límite.
- qr_updated_at / qr_updated_by_id: último cambio del QR (el detalle va en audit_logs).
Ejecutar con: python -m app.infrastructure.database.migrations.add_qr_audit_to_branches
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "branches" not in inspector.get_table_names():
        print("La tabla branches no existe todavia.")
        return
    columns = {c["name"] for c in inspector.get_columns("branches")}
    dialect = engine.dialect.name
    timestamp = "TIMESTAMP WITH TIME ZONE" if dialect == "postgresql" else "DATETIME"

    with engine.connect() as conn:
        if dialect == "mysql":
            conn.execute(text("ALTER TABLE branches MODIFY COLUMN qr_image_url MEDIUMTEXT NULL"))
        if "qr_updated_at" not in columns:
            conn.execute(text(f"ALTER TABLE branches ADD COLUMN qr_updated_at {timestamp} NULL"))
            print("Columna qr_updated_at agregada a branches.")
        if "qr_updated_by_id" not in columns:
            conn.execute(text("ALTER TABLE branches ADD COLUMN qr_updated_by_id INTEGER NULL"))
            print("Columna qr_updated_by_id agregada a branches.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
