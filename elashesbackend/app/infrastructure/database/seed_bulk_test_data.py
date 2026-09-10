"""Seeder masivo para PRUEBAS de rendimiento y reportes.

Genera un conjunto grande de datos coherentes con los modelos actuales del
backend (clientes, citas, ventas POS, pagos, seguimientos, gastos y movimientos
de inventario) sin agregar dependencias externas como Faker.

Uso recomendado (SOLO desarrollo/pruebas):

    python -m app.infrastructure.database.seed_bulk_test_data --count 1000 --confirm

Opciones:
    --count N   cantidad de escenarios/clientes a generar (default: 1000)
    --seed N    semilla aleatoria para resultados reproducibles
    --confirm   obligatorio; evita ejecuciones accidentales

El script es idempotente para los registros BULK: si se ejecuta otra vez con el
mismo --count, reutiliza los clientes/citas/ventas/pagos ya creados por código.
"""
from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config.settings import settings
from app.domain.entities.branch import Branch
from app.domain.entities.client import (
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_FINALIZADO,
    CLIENT_STATUS_RESERVA,
    Client,
)
from app.domain.entities.expense import Expense
from app.domain.entities.inventory import Batch, InventoryMovement, Product
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import (
    Appointment,
    AppointmentService,
    Service,
)
from app.domain.entities.tracking import (
    Effect,
    EyeType,
    LashDesign,
    Questionnaire,
    Tracking,
    Volume,
)
from app.domain.entities.user import Role, User
from app.infrastructure.database.init_db import init_db
from app.infrastructure.database.seeders import run_seeders
from app.infrastructure.database.session import SessionLocal


FIRST_NAMES = [
    "Ana", "Maria", "Sofia", "Valentina", "Camila", "Lucia", "Daniela",
    "Gabriela", "Carla", "Natalia", "Paola", "Andrea", "Fernanda", "Alejandra",
    "Mariana", "Laura", "Isabel", "Micaela", "Nicole", "Adriana",
]
LAST_NAMES = [
    "Perez", "Gomez", "Rojas", "Cruz", "Torres", "Vargas", "Flores", "Rios",
    "Salinas", "Mendez", "Lopez", "Rodriguez", "Fernandez", "Sanchez",
    "Romero", "Mamani", "Quispe", "Choque", "Rivera", "Aguilar",
]
PAYMENT_METHODS = ["cash", "qr", "card", "transfer"]
EXPENSE_DESCRIPTIONS = [
    "Compra de insumos", "Movilidad", "Limpieza", "Material descartable",
    "Papeleria", "Mantenimiento menor", "Reposicion de herramientas",
]


def _is_production() -> bool:
    env = (settings.environment or "").strip().lower()
    return env in {"production", "prod"}


def _need(seq, name: str):
    if not seq:
        raise RuntimeError(
            f"No existen registros de {name}. Ejecuta primero los seeders base."
        )
    return seq


def _professional_by_branch(db: Session) -> dict[int, list[User]]:
    operaria_role = db.query(Role).filter(Role.name == "Operaria").first()
    if not operaria_role:
        return {}
    users = (
        db.query(User)
        .filter(User.role_id == operaria_role.id, User.is_active.is_(True))
        .all()
    )
    result: dict[int, list[User]] = {}
    for user in users:
        if user.branch_id is not None:
            result.setdefault(user.branch_id, []).append(user)
    return result


def seed_bulk_test_data(db: Session, count: int = 1000, seed: int = 20260910) -> dict[str, int]:
    if count < 1:
        raise ValueError("--count debe ser mayor que 0")

    rng = random.Random(seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
    now_aware = datetime.now(timezone.utc).replace(second=0, microsecond=0)

    branches = _need(db.query(Branch).order_by(Branch.id).all(), "sucursales")
    services = _need(
        db.query(Service).filter(Service.is_active.is_(True)).order_by(Service.id).all(),
        "servicios activos",
    )
    eye_types = _need(db.query(EyeType).order_by(EyeType.id).all(), "tipos de ojo")
    effects = _need(db.query(Effect).order_by(Effect.id).all(), "efectos")
    volumes = _need(db.query(Volume).order_by(Volume.id).all(), "volumenes")
    lash_designs = _need(db.query(LashDesign).order_by(LashDesign.id).all(), "disenos")
    questionnaire = db.query(Questionnaire).order_by(Questionnaire.id).first()

    professionals = _professional_by_branch(db)
    all_professionals = [u for users in professionals.values() for u in users]
    _need(all_professionals, "operarias")

    # Para datos de inventario y reportes.
    products = db.query(Product).filter(Product.status.is_(True)).order_by(Product.id).all()
    batches = db.query(Batch).order_by(Batch.id).all()

    stats = {
        "clients": 0,
        "appointments": 0,
        "appointment_services": 0,
        "sales": 0,
        "payments": 0,
        "trackings": 0,
        "expenses": 0,
        "inventory_movements": 0,
    }

    # Distribucion intencional para probar filtros/reportes.
    # 65% completed, 15% pending, 10% confirmed, 10% cancelled.
    status_pool = (
        ["completed"] * 65
        + ["pending"] * 15
        + ["confirmed"] * 10
        + ["cancelled"] * 10
    )

    for i in range(1, count + 1):
        marker = f"BULK-{i:06d}"
        branch = branches[(i - 1) % len(branches)]
        professional_pool = professionals.get(branch.id) or all_professionals
        professional = professional_pool[(i - 1) % len(professional_pool)]
        eye_type = eye_types[(i - 1) % len(eye_types)]

        # ---------------------------------------------------------
        # Cliente
        # ---------------------------------------------------------
        client = db.query(Client).filter(Client.ci == marker).first()
        if not client:
            first = FIRST_NAMES[(i - 1) % len(FIRST_NAMES)]
            last = LAST_NAMES[((i - 1) // len(FIRST_NAMES)) % len(LAST_NAMES)]
            client = Client(
                name=first,
                last_name=f"{last} {i:04d}",
                age=18 + (i % 43),
                phone=f"78{i:08d}"[-10:],
                email=f"bulk.client.{i:06d}@example.test",
                branch_id=branch.id,
                eye_type_id=eye_type.id,
                status=CLIENT_STATUS_EN_ESPERA,
                last_activity_at=now_aware - timedelta(days=i % 180),
                ci=marker,
                marketplace_enabled=(i % 7 != 0),
            )
            db.add(client)
            db.flush()
            stats["clients"] += 1

        # ---------------------------------------------------------
        # Cita
        # ---------------------------------------------------------
        ticket_code = f"BULK-TKT-{i:06d}"
        appointment = (
            db.query(Appointment)
            .filter(Appointment.ticket_code == ticket_code)
            .first()
        )
        status = status_pool[(i - 1) % len(status_pool)]
        # Cubre aprox. 12 meses hacia atras y 30 dias hacia adelante.
        day_offset = (i % 395) - 365
        hour = 8 + (i % 10)
        minute = (i % 4) * 15
        start_time = (now + timedelta(days=day_offset)).replace(
            hour=hour, minute=minute
        )

        primary_service = services[(i - 1) % len(services)]
        # Cada 5 registros agrega un segundo servicio.
        service_list = [primary_service]
        if i % 5 == 0 and len(services) > 1:
            extra = services[i % len(services)]
            if extra.id != primary_service.id:
                service_list.append(extra)
        duration = sum(max(s.duration_minutes or 30, 15) for s in service_list)
        end_time = start_time + timedelta(minutes=duration)

        if not appointment:
            appointment = Appointment(
                ticket_code=ticket_code,
                client_id=client.id,
                created_by_id=professional.id,
                professional_id=professional.id,
                service_id=primary_service.id,
                branch_id=branch.id,
                is_ia=(i % 11 == 0),
                start_time=start_time,
                end_time=end_time,
                status=status,
                advance_payment_amount=0.0 if i % 4 else round(primary_service.effective_price * 0.25, 2),
            )
            db.add(appointment)
            db.flush()
            stats["appointments"] += 1

            for order, service in enumerate(service_list):
                db.add(
                    AppointmentService(
                        appointment_id=appointment.id,
                        service_id=service.id,
                        sort_order=order,
                    )
                )
                stats["appointment_services"] += 1

        # Ajusta un status de cliente razonable para probar la UI.
        if status == "completed":
            client.status = CLIENT_STATUS_FINALIZADO
        elif status in {"pending", "confirmed"}:
            client.status = CLIENT_STATUS_RESERVA
        else:
            client.status = CLIENT_STATUS_EN_ESPERA

        # ---------------------------------------------------------
        # Venta POS + pago: para las citas completadas
        # ---------------------------------------------------------
        if status == "completed":
            subtotal = round(sum(float(s.effective_price) for s in service_list), 2)
            discount_type = "percent" if i % 9 == 0 else "amount"
            discount_value = 10.0 if discount_type == "percent" else (5.0 if i % 13 == 0 else 0.0)
            total = (
                subtotal * (1 - discount_value / 100.0)
                if discount_type == "percent"
                else max(0.0, subtotal - discount_value)
            )
            total = round(total, 2)
            method = PAYMENT_METHODS[i % len(PAYMENT_METHODS)]

            sale_code = f"BULK-SALE-{i:06d}"
            sale = db.query(PosSale).filter(PosSale.sale_code == sale_code).first()
            if not sale:
                sale = PosSale(
                    sale_code=sale_code,
                    client_id=client.id,
                    branch_id=branch.id,
                    created_by_id=professional.id,
                    subtotal=subtotal,
                    discount_type=discount_type,
                    discount_value=discount_value,
                    total=total,
                    payment_method=method,
                    status="paid",
                    notes="[BULK] Venta generada por seeder masivo",
                    created_at=start_time,
                )
                db.add(sale)
                db.flush()
                stats["sales"] += 1

            if appointment.sale_id is None:
                appointment.sale_id = sale.id

            reference = f"BULK-PAY-{i:06d}"
            payment = db.query(Payment).filter(Payment.reference == reference).first()
            if not payment:
                cash_received = None
                cash_change = None
                if method == "cash":
                    cash_received = float(int(total / 10 + 1) * 10)
                    if cash_received < total:
                        cash_received = total
                    cash_change = round(cash_received - total, 2)

                db.add(
                    Payment(
                        client_id=client.id,
                        branch_id=branch.id,
                        appointment_id=appointment.id,
                        sale_id=sale.id,
                        registered_by_id=professional.id,
                        amount=total,
                        method=method,
                        status="paid",
                        reference=reference,
                        notes="[BULK] Pago de prueba",
                        paid_at=end_time,
                        cash_received=cash_received,
                        cash_change=cash_change,
                    )
                )
                stats["payments"] += 1

            # -----------------------------------------------------
            # Seguimiento para citas completadas
            # -----------------------------------------------------
            tracking = (
                db.query(Tracking)
                .filter(Tracking.appointment_id == appointment.id)
                .first()
            )
            if not tracking:
                db.add(
                    Tracking(
                        client_id=client.id,
                        appointment_id=appointment.id,
                        branch_id=branch.id,
                        professional_id=professional.id,
                        eye_type_id=eye_type.id,
                        effect_id=effects[(i - 1) % len(effects)].id,
                        volume_id=volumes[(i - 1) % len(volumes)].id,
                        lash_design_id=lash_designs[(i - 1) % len(lash_designs)].id,
                        questionnaire_id=questionnaire.id if questionnaire else None,
                        design_notes=f"[BULK] Seguimiento generado {i:06d}",
                        last_application_date=end_time,
                        questionnaire_responses={
                            "alergias": "no" if i % 10 else "consultar",
                            "usa_lentes": "si" if i % 6 == 0 else "no",
                        },
                        next_maintenance_date=end_time + timedelta(days=20),
                        next_removal_date=end_time + timedelta(days=35),
                    )
                )
                stats["trackings"] += 1

        # Flush por bloques para no acumular miles de objetos pendientes.
        if i % 100 == 0:
            db.flush()
            print(f"   escenarios procesados: {i}/{count}")

    # -------------------------------------------------------------
    # Gastos: ~25% del count, suficientes para reportes/corte de caja.
    # -------------------------------------------------------------
    expense_count = max(1, count // 4)
    existing_bulk_expenses = (
        db.query(Expense)
        .filter(Expense.description.like("[BULK]%"))
        .count()
    )
    for i in range(existing_bulk_expenses + 1, expense_count + 1):
        branch = branches[(i - 1) % len(branches)]
        professional_pool = professionals.get(branch.id) or all_professionals
        creator = professional_pool[(i - 1) % len(professional_pool)]
        db.add(
            Expense(
                branch_id=branch.id,
                amount=round(10 + rng.random() * 240, 2),
                description=f"[BULK] {EXPENSE_DESCRIPTIONS[(i - 1) % len(EXPENSE_DESCRIPTIONS)]} #{i:05d}",
                expense_date=(now - timedelta(days=i % 180)).date(),
                created_at=now_aware - timedelta(days=i % 180),
                created_by_id=creator.id,
            )
        )
        stats["expenses"] += 1

    # -------------------------------------------------------------
    # Movimientos de inventario: hasta count movimientos.
    # Solo si el seeder base pudo crear productos/lotes.
    # -------------------------------------------------------------
    if products:
        existing_bulk_movements = (
            db.query(InventoryMovement)
            .filter(InventoryMovement.note.like("[BULK]%"))
            .count()
        )
        for i in range(existing_bulk_movements + 1, count + 1):
            product = products[(i - 1) % len(products)]
            product_batches = [b for b in batches if b.product_id == product.id]
            batch = product_batches[(i - 1) % len(product_batches)] if product_batches else None
            branch_id = batch.branch_id if batch else branches[(i - 1) % len(branches)].id
            movement_type = ["IN", "OUT", "ADJUSTMENT", "SERVICE_USE"][i % 4]
            quantity = float(1 + (i % 5))
            db.add(
                InventoryMovement(
                    product_id=product.id,
                    batch_id=batch.id if batch else None,
                    branch_id=branch_id,
                    movement_type=movement_type,
                    quantity=quantity,
                    note=f"[BULK] Movimiento de prueba #{i:06d}",
                    created_at=now - timedelta(hours=i % (24 * 120)),
                )
            )
            stats["inventory_movements"] += 1

    db.commit()
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Seeder masivo de datos de prueba")
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20260910)
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirma que deseas insertar datos masivos de PRUEBA",
    )
    args = parser.parse_args()

    if not args.confirm:
        print(
            "Cancelado: agrega --confirm. Ejemplo:\n"
            "python -m app.infrastructure.database.seed_bulk_test_data --count 1000 --confirm",
            file=sys.stderr,
        )
        raise SystemExit(2)

    if _is_production():
        print(
            "BLOQUEADO: ENVIRONMENT indica produccion. Este seeder es solo para desarrollo/pruebas.",
            file=sys.stderr,
        )
        raise SystemExit(3)

    print(f">>> BD objetivo: {settings.database_url}")
    print(f">>> Ambiente: {settings.environment}")
    print(f">>> Escenarios solicitados: {args.count}")

    # Los imports de modelos de arriba dejan todo registrado en Base.metadata.
    init_db()
    db = SessionLocal()
    try:
        # Crea/actualiza datos esenciales: roles, sucursales, operarias,
        # catalogos, servicios e inventario. Los datos demo chicos siguen
        # obedeciendo SEED_DEMO_DATA del proyecto.
        run_seeders(db)
        stats = seed_bulk_test_data(db, count=args.count, seed=args.seed)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    print("\n>>> Seeder masivo finalizado <<<")
    for key, value in stats.items():
        print(f"   {key:<22}: +{value}")
    print("\nNota: +0 significa que esos registros BULK ya existian.")


if __name__ == "__main__":
    main()
