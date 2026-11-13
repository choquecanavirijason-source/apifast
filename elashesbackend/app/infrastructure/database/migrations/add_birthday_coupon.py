"""
Migracion: crea las tablas del cupon de cumpleanos.
  - birthday_coupon_config: configuracion (una fila) que define el administrador.
  - coupon_redemptions: cada vez que una clienta usa el cupon (una vez por cumpleanos).
Ejecutar con: python -m app.infrastructure.database.migrations.add_birthday_coupon

Se crean desde la definicion de las entidades (checkfirst) para que el DDL sea valido en
SQLite, MySQL y Postgres sin ramas por dialecto.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect

from app.domain.entities.birthday_coupon import BirthdayCouponConfig, CouponRedemption
from app.domain.entities.client import Client  # noqa: F401  (FK clients.id)
from app.domain.entities.pos_sale import PosSale  # noqa: F401  (FK pos_sales.id)
from app.domain.entities.user import User  # noqa: F401  (FK users.id)
from app.infrastructure.database import engine


def upgrade():
    existing = set(inspect(engine).get_table_names())
    for model in (BirthdayCouponConfig, CouponRedemption):
        name = model.__tablename__
        if name in existing:
            print(f"La tabla {name} ya existe.")
            continue
        model.__table__.create(bind=engine, checkfirst=True)
        print(f"Tabla {name} creada.")


if __name__ == "__main__":
    upgrade()
