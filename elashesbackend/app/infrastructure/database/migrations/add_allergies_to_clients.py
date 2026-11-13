"""
Migracion: clients.allergies, clients.allergies_checked_at y clients.birth_date.

  - allergies: alergias especificas de la clienta a algun producto, para que el
    personal que la atiende lo sepa (ticket y app de operarias).
  - allergies_checked_at: cuando el personal le CONFIRMO las alergias (aunque no
    tenga). Distingue "se le pregunto y no tiene" de "nadie le pregunto", y
    decide si se pregunta al iniciar la atencion.

  - birth_date: fecha de nacimiento (opcional). La edad se calcula a partir de ella y
    permite ofrecer el cupon de cumpleanos.

Ejecutar con: python -m app.infrastructure.database.migrations.add_allergies_to_clients

Todas nullable: las clientas existentes quedan sin alergias, sin confirmar y sin fecha.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "clients" not in inspector.get_table_names():
        print("La tabla clients no existe todavia.")
        return

    columns = {c["name"] for c in inspector.get_columns("clients")}
    datetime_type = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
    wanted = (
        ("allergies", "VARCHAR(500)"),
        ("allergies_checked_at", datetime_type),
        ("birth_date", "DATE"),
    )

    with engine.connect() as conn:
        for name, sql_type in wanted:
            if name in columns:
                print(f"La columna {name} ya existe en clients.")
                continue
            conn.execute(text(f"ALTER TABLE clients ADD COLUMN {name} {sql_type}"))
            print(f"Columna {name} agregada a clients.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
