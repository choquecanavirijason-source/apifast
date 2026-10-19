"""
Migracion: tabla manual_reminders (recordatorios enviados a mano desde el
panel) y permiso reminders:send.
Ejecutar con: python -m app.infrastructure.database.migrations.add_manual_reminders

La tabla se crea desde la definicion de la entidad (checkfirst) para que el
DDL sea valido en SQLite, MySQL y Postgres sin ramas por dialecto.

El permiso se asigna a los roles admin SOLO cuando se crea: si despues se lo
quitan a un rol desde el panel, la migracion (que corre en cada arranque) no
se lo vuelve a dar.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect

from app.domain.entities.client import Client  # noqa: F401  (FK clients.id)
from app.domain.entities.manual_reminder import ManualReminder
from app.domain.entities.service_agenda import Appointment  # noqa: F401  (FK appointments.id)
from app.domain.entities.user import Permission, Role
from app.infrastructure.database import SessionLocal, engine

REMINDERS_PERMISSION = "reminders:send"
ADMIN_ROLE_NAMES = ("SuperAdmin", "Admin", "admin")


def upgrade():
    if "manual_reminders" in inspect(engine).get_table_names():
        print("La tabla manual_reminders ya existe.")
    else:
        ManualReminder.__table__.create(bind=engine, checkfirst=True)
        print("Tabla manual_reminders creada.")

    db = SessionLocal()
    try:
        if db.query(Permission).filter(Permission.name == REMINDERS_PERMISSION).first():
            print(f"El permiso {REMINDERS_PERMISSION} ya existe.")
            return
        perm = Permission(name=REMINDERS_PERMISSION)
        db.add(perm)
        db.flush()
        for role in db.query(Role).filter(Role.name.in_(ADMIN_ROLE_NAMES)).all():
            role.permissions.append(perm)
        db.commit()
        print(f"Permiso {REMINDERS_PERMISSION} creado y asignado a los roles admin.")
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()
