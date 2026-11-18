"""
Borra la(s) "Sucursal Simulación" que creó simulacion_dia.py, con TODO lo que tiene dentro: ventas y pagos, tickets,
gastos, bonos, cierres de caja, pagos de comisión, inventario de los productos de prueba "(sim)", las operarias de
prueba (@simulacion.com) y la clienta "mostrador" de esa sucursal. No toca las otras sucursales ni las clientas reales.

Por defecto solo MUESTRA lo que borraría; para borrar hay que pasar --apply.

Uso (dentro del contenedor del backend, carpeta /app):
  python limpiar_simulacion.py            # ver qué se borraría
  python limpiar_simulacion.py --apply    # borrar (todo en una sola transacción)
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app.infrastructure.database.init_db  # noqa: E402,F401  (registra todos los modelos)
from app.domain.entities.audit_log import AuditLog  # noqa: E402
from app.domain.entities.branch import Branch  # noqa: E402
from app.domain.entities.cash_close import CashClose, CommissionReceipt  # noqa: E402
from app.domain.entities.client import Client  # noqa: E402
from app.domain.entities.commission_payment import CommissionPayment  # noqa: E402
from app.domain.entities.expense import Expense  # noqa: E402
from app.domain.entities.inventory import Batch, InventoryMovement, Product  # noqa: E402
from app.domain.entities.manual_reminder import ManualReminder  # noqa: E402
from app.domain.entities.operator_bonus import OperatorBonus  # noqa: E402
from app.domain.entities.payment import Payment  # noqa: E402
from app.domain.entities.pos_sale import PosSale, PosSaleProduct  # noqa: E402
from app.domain.entities.service_agenda import Appointment, AppointmentService, BranchService  # noqa: E402
from app.domain.entities.tracking import Tracking  # noqa: E402
from app.domain.entities.user import User  # noqa: E402
from app.infrastructure.database import SessionLocal  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("--apply", action="store_true", help="borrar de verdad (sin esto solo se muestra el plan)")
args = parser.parse_args()

db = SessionLocal()
try:
    branches = db.query(Branch).filter(Branch.name.like("Sucursal Simulación%")).all()
    if not branches:
        print("No hay ninguna 'Sucursal Simulación'. Nada que borrar.")
        sys.exit(0)
    ids = [b.id for b in branches]
    sim_users = db.query(User).filter(User.email.like("%@simulacion.com")).all()
    sim_user_ids = [u.id for u in sim_users]

    sale_ids = [i for (i,) in db.query(PosSale.id).filter(PosSale.branch_id.in_(ids))]
    appt_ids = [i for (i,) in db.query(Appointment.id).filter(Appointment.branch_id.in_(ids))]
    sim_products = db.query(Product).filter(Product.name.like("%(sim)")).all()

    plan = [
        ("Sucursales", len(ids)),
        ("Ventas", len(sale_ids)),
        ("Tickets", len(appt_ids)),
        ("Pagos de ventas", db.query(Payment).filter(Payment.branch_id.in_(ids)).count()),
        ("Gastos", db.query(Expense).filter(Expense.branch_id.in_(ids)).count()),
        ("Extras y bonos", db.query(OperatorBonus).filter(OperatorBonus.branch_id.in_(ids)).count()),
        ("Cierres de caja", db.query(CashClose).filter(CashClose.branch_id.in_(ids)).count()),
        ("Pagos de comisión", db.query(CommissionPayment).filter(CommissionPayment.professional_id.in_(sim_user_ids)).count() if sim_user_ids else 0),
        ("Operarias de prueba", len(sim_users)),
        ("Productos de prueba (sim)", len(sim_products)),
    ]
    print("Sucursales de simulación:", ", ".join(f"#{b.id} {b.name}" for b in branches))
    for label, count in plan:
        print(f"  {label}: {count}")
    if not args.apply:
        print("\n(Plan solamente: no se borró nada. Para borrar agrega --apply)")
        sys.exit(0)

    # Primero lo que depende de otras cosas, al final la sucursal.
    db.query(Payment).filter(Payment.branch_id.in_(ids)).delete(synchronize_session=False)
    if sale_ids:
        db.query(PosSaleProduct).filter(PosSaleProduct.sale_id.in_(sale_ids)).delete(synchronize_session=False)
    if appt_ids:
        # Lo que cuelga de los tickets: seguimiento de la clienta y recordatorios.
        db.query(Tracking).filter(Tracking.appointment_id.in_(appt_ids)).delete(synchronize_session=False)
        db.query(ManualReminder).filter(ManualReminder.appointment_id.in_(appt_ids)).delete(synchronize_session=False)
        db.query(AppointmentService).filter(AppointmentService.appointment_id.in_(appt_ids)).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.id.in_(appt_ids)).delete(synchronize_session=False)
    if sale_ids:
        db.query(PosSale).filter(PosSale.id.in_(sale_ids)).delete(synchronize_session=False)
    if sim_user_ids:
        db.query(CommissionPayment).filter(CommissionPayment.professional_id.in_(sim_user_ids)).delete(synchronize_session=False)
    db.query(Expense).filter(Expense.branch_id.in_(ids)).delete(synchronize_session=False)
    db.query(OperatorBonus).filter(OperatorBonus.branch_id.in_(ids)).delete(synchronize_session=False)
    db.query(CashClose).filter(CashClose.branch_id.in_(ids)).delete(synchronize_session=False)
    db.query(CommissionReceipt).filter(CommissionReceipt.branch_id.in_(ids)).delete(synchronize_session=False)
    audit = db.query(AuditLog).filter(AuditLog.branch_id.in_(ids))
    audit.delete(synchronize_session=False)
    if sim_user_ids:
        db.query(AuditLog).filter(AuditLog.user_id.in_(sim_user_ids)).delete(synchronize_session=False)

    # Inventario de la sucursal y productos de prueba.
    db.query(InventoryMovement).filter(InventoryMovement.branch_id.in_(ids)).delete(synchronize_session=False)
    db.query(Batch).filter(Batch.branch_id.in_(ids)).delete(synchronize_session=False)
    for product in sim_products:
        db.query(InventoryMovement).filter(InventoryMovement.product_id == product.id).delete(synchronize_session=False)
        if db.query(Batch).filter(Batch.product_id == product.id).count() == 0:
            db.delete(product)

    db.query(Client).filter(Client.branch_id.in_(ids)).delete(synchronize_session=False)
    db.query(BranchService).filter(BranchService.branch_id.in_(ids)).delete(synchronize_session=False)
    for user in sim_users:
        user.direct_permissions = []
        db.flush()
        db.delete(user)
    db.flush()
    for branch in branches:
        db.delete(branch)
    db.commit()
    print("\nListo: la simulación se borró por completo.")
except SystemExit:
    raise
except Exception as error:
    db.rollback()
    print(f"\nNo se pudo borrar (no se cambió nada): {error}")
    sys.exit(1)
finally:
    db.close()
