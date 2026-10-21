"""
Migracion: pago de comision por ticket (Historial de tickets > Confirmar pago).
  - appointments: pagado (NOT NULL, false), pagado_en, pagado_por,
    pagado_monto y commission_payment_id (indexada).
  - permisos commissions:pay (confirmar pagos) y commissions:void (anularlos).
Ejecutar con: python -m app.infrastructure.database.migrations.add_commission_paid_to_appointments

Aqui solo se crean los permisos: a que roles van lo decide seed_roles en
seeders.py, que reasigna los permisos de cada rol en cada arranque.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.domain.entities.user import Permission
from app.infrastructure.database import SessionLocal, engine

COMMISSION_PERMISSIONS = ("commissions:pay", "commissions:void")
INDEX_NAME = "ix_appointments_commission_payment_id"


def upgrade():
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        print("La tabla appointments no existe todavia.")
        return

    dialect = engine.dialect.name
    datetime_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
    false_literal = "0" if dialect == "sqlite" else "false"
    columns = {c["name"] for c in inspector.get_columns("appointments")}
    indexes = {ix["name"] for ix in inspector.get_indexes("appointments")}

    new_columns = [
        ("pagado", f"BOOLEAN NOT NULL DEFAULT {false_literal}"),
        ("pagado_en", datetime_type),
        ("pagado_por", "INTEGER"),
        ("pagado_monto", "FLOAT"),
        ("commission_payment_id", "INTEGER"),
    ]
    with engine.connect() as conn:
        for name, ddl in new_columns:
            if name in columns:
                print(f"La columna {name} ya existe en appointments.")
                continue
            conn.execute(text(f"ALTER TABLE appointments ADD COLUMN {name} {ddl}"))
            print(f"Columna {name} agregada a appointments.")
        if INDEX_NAME not in indexes:
            conn.execute(text(f"CREATE INDEX {INDEX_NAME} ON appointments (commission_payment_id)"))
            print(f"Indice {INDEX_NAME} creado.")
        conn.commit()

    db = SessionLocal()
    try:
        for name in COMMISSION_PERMISSIONS:
            if db.query(Permission).filter(Permission.name == name).first():
                print(f"El permiso {name} ya existe.")
                continue
            db.add(Permission(name=name))
            print(f"Permiso {name} creado.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
