"""
Migracion: pos_sales.combo_data (JSON) guarda las promociones aplicadas a la venta para recalcular
bien el total al editar o cancelar tickets.
Ejecutar con: python -m app.infrastructure.database.migrations.add_combo_data_to_pos_sales
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "pos_sales" not in inspector.get_table_names():
        print("La tabla pos_sales no existe todavia.")
        return
    if "combo_data" in {c["name"] for c in inspector.get_columns("pos_sales")}:
        print("La columna combo_data ya existe en pos_sales.")
        return
    column_type = "TEXT" if engine.dialect.name == "sqlite" else "JSON"
    with engine.connect() as conn:
        conn.execute(text(f"ALTER TABLE pos_sales ADD COLUMN combo_data {column_type} NULL"))
        conn.commit()
    print("Columna combo_data agregada a pos_sales.")


if __name__ == "__main__":
    upgrade()
