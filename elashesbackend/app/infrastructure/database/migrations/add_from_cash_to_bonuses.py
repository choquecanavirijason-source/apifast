"""
Migracion: los extras y bonos recuerdan si salieron del efectivo de la caja.
  - operator_bonuses.from_cash (NOT NULL, false)
  - cash_closes.cash_extras: extras y bonos pagados en efectivo durante la sesion
    (se resta del efectivo esperado en el arqueo del cierre).
Ejecutar con: python -m app.infrastructure.database.migrations.add_from_cash_to_bonuses
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    false_literal = "0" if engine.dialect.name == "sqlite" else "false"
    plan = [
        ("operator_bonuses", "from_cash", f"BOOLEAN NOT NULL DEFAULT {false_literal}"),
        ("cash_closes", "cash_extras", "FLOAT"),
    ]
    with engine.connect() as conn:
        for table, column, ddl in plan:
            if table not in tables:
                print(f"La tabla {table} no existe todavia.")
                continue
            if column in {c["name"] for c in inspector.get_columns(table)}:
                print(f"La columna {column} ya existe en {table}.")
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            print(f"Columna {column} agregada a {table}.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
