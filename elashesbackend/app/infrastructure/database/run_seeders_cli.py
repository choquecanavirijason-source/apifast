"""
Ejecutar seeders sin levantar toda la API.

Uso (desde la carpeta elashesbackend):
  python -m app.infrastructure.database.run_seeders_cli
"""
from __future__ import annotations

import sys

from app.infrastructure.database.init_db import init_db
from app.infrastructure.database.seeders import run_seeders
from app.infrastructure.database.seed_operarias import seed_operarias, OPERARIAS
from app.infrastructure.database.session import SessionLocal


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        run_seeders(db)

        created, updated = seed_operarias(db)
        print()
        print(">>> Operarias de prueba <<<")
        print(f"   Creadas: {len(created)}  |  Actualizadas: {len(updated)}")
        print(f"   {'Usuario':<25} {'Sucursal':<22} {'Nivel':<7} {'Activa'}")
        print(f"   {'-'*68}")
        for item in OPERARIAS:
            activa = "Si" if item["is_active"] else "No"
            nivel = str(item["skill_level"]) if item["skill_level"] else "-"
            print(f"   {item['username']:<25} {item['branch']:<22} {nivel:<7} {activa}")
        print("   Password de todas: test1234")
    except Exception as exc:
        print(f">>> Error ejecutando seeders: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
