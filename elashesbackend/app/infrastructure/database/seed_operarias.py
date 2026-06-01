"""
Seeder de operarias para pruebas.

Crea 8 operarias con distintos niveles de habilidad, sucursales y estados,
sin tocar el resto del sistema (roles, permisos, etc. ya deben existir).

Uso (desde la carpeta elashesbackend):
  python -m app.infrastructure.database.seed_operarias
"""
from __future__ import annotations

import sys
from sqlalchemy.orm import Session

from app.infrastructure.database.session import SessionLocal
from app.infrastructure.security import get_password_hash
from app.domain.entities.user import User, Role
from app.domain.entities.branch import Branch


# ── Datos de las operarias de prueba ─────────────────────────────────────────

OPERARIAS: list[dict] = [
    {
        "username": "operaria_luna",
        "email": "operaria.luna@elashes.com",
        "phone": "+59171100001",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 5,
        "is_active": True,
        "note": "Senior · especialista en extensiones volumen",
    },
    {
        "username": "operaria_sofia",
        "email": "operaria.sofia@elashes.com",
        "phone": "+59171100002",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 4,
        "is_active": True,
        "note": "Experimentada · retoques y lifting",
    },
    {
        "username": "operaria_ana",
        "email": "operaria.ana@elashes.com",
        "phone": "+59171100003",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 3,
        "is_active": True,
        "note": "Intermedia · clásicas y retoques",
    },
    {
        "username": "operaria_carla",
        "email": "operaria.carla@elashes.com",
        "phone": "+59171100004",
        "password": "test1234",
        "branch": "Sucursal Norte",
        "skill_level": 5,
        "is_active": True,
        "note": "Senior en Sucursal Norte",
    },
    {
        "username": "operaria_maria",
        "email": "operaria.maria@elashes.com",
        "phone": "+59171100005",
        "password": "test1234",
        "branch": "Sucursal Norte",
        "skill_level": 3,
        "is_active": True,
        "note": "Intermedia en Sucursal Norte",
    },
    {
        "username": "operaria_rosa",
        "email": "operaria.rosa@elashes.com",
        "phone": "+59171100006",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 2,
        "is_active": True,
        "note": "Junior · en formación",
    },
    {
        "username": "operaria_paula",
        "email": "operaria.paula@elashes.com",
        "phone": "+59171100007",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 1,
        "is_active": True,
        "note": "Trainee · solo servicios básicos",
    },
    {
        "username": "operaria_inactiva",
        "email": "operaria.inactiva@elashes.com",
        "phone": "+59171100008",
        "password": "test1234",
        "branch": "Sucursal Principal",
        "skill_level": 3,
        "is_active": False,
        "note": "Inactiva — útil para probar filtros de estado",
    },
]


# ── Lógica del seeder ─────────────────────────────────────────────────────────

def seed_operarias(db: Session) -> list[User]:
    role = db.query(Role).filter(Role.name == "Operaria").first()
    if not role:
        raise RuntimeError(
            "El rol 'Operaria' no existe. Ejecuta primero el seeder principal: "
            "python -m app.infrastructure.database.run_seeders_cli"
        )

    branch_cache: dict[str, Branch] = {}

    def get_branch(name: str) -> Branch:
        if name not in branch_cache:
            branch = db.query(Branch).filter(Branch.name == name).first()
            if not branch:
                raise RuntimeError(
                    f"Sucursal '{name}' no encontrada. Ejecuta primero el seeder principal."
                )
            branch_cache[name] = branch
        return branch_cache[name]

    created: list[User] = []
    updated: list[User] = []

    for item in OPERARIAS:
        branch = get_branch(item["branch"])
        user = db.query(User).filter(User.username == item["username"]).first()

        if user:
            user.email = item["email"]
            user.is_active = item["is_active"]
            user.role_id = role.id
            user.branch_id = branch.id
            user.skill_level = item["skill_level"]
            updated.append(user)
        else:
            user = User(
                username=item["username"],
                email=item["email"],
                phone=item["phone"],
                hashed_password=get_password_hash(item["password"]),
                is_active=item["is_active"],
                role_id=role.id,
                branch_id=branch.id,
                skill_level=item["skill_level"],
            )
            db.add(user)
            db.flush()
            created.append(user)

    db.commit()
    return created, updated


# ── Entrada CLI ───────────────────────────────────────────────────────────────

def main() -> None:
    db = SessionLocal()
    try:
        created, updated = seed_operarias(db)
        print(f"\n{'='*50}")
        print(f"  Seeder operarias completado")
        print(f"  Creadas : {len(created)}")
        print(f"  Actualizadas: {len(updated)}")
        print(f"{'='*50}")
        print("\n  Credenciales de acceso (todas con password: test1234)")
        print(f"  {'Usuario':<25} {'Sucursal':<22} {'Nivel':<7} {'Activa'}")
        print(f"  {'-'*70}")
        for item in OPERARIAS:
            activa = "Si" if item["is_active"] else "No"
            nivel = str(item["skill_level"]) if item["skill_level"] else "-"
            print(f"  {item['username']:<25} {item['branch']:<22} {nivel:<7} {activa}")
        print()
    except Exception as exc:
        print(f"\n>>> Error: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
