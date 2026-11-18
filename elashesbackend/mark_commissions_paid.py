"""
Regulariza las comisiones de DATOS DE PRUEBA: deja como pagados todos los servicios completados que aún no lo
están y borra los pagos manuales antiguos (los que no marcan servicios), para que "Comisión ganada", "Ya pagado" y
"Falta pagar" cuadren.

NO es para datos reales: hace esto sin preguntar tickets uno por uno. Por defecto solo MUESTRA lo que haría;
para guardar hay que pasar --apply.

Uso (dentro del contenedor del backend, carpeta /app):
  python mark_commissions_paid.py                  # ver el plan, no cambia nada
  python mark_commissions_paid.py --apply          # aplicar
  python mark_commissions_paid.py --apply --fecha 2026-11-17 --usuario admin

Qué hace con --apply, todo en una sola transacción:
  1. Borra los pagos de comisión que no están ligados a ningún ticket (pagos manuales / de pruebas anteriores).
  2. Por cada operaria crea UN pago (por servicios, sin tocar el efectivo de la caja) con la suma de sus servicios
     completados pendientes y marca esos servicios como pagados (monto, fecha, quién y a qué pago pertenecen).
  3. Deja un registro en Auditoría por cada pago.
Las fechas del pago se ponen en el pasado (--fecha, por defecto ayer al mediodía) para no ensuciar el Corte de caja de hoy.

ANTES de aplicarlo en un servidor, respalda las tablas:
  docker exec elashes-postgres pg_dump -U <usuario> -d <base> -t commission_payments -t appointments > respaldo_comisiones.sql
"""
import argparse
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.application.services.commission_payout_service import appointment_commission  # noqa: E402
from app.domain.entities.audit_log import AuditLog  # noqa: E402
from app.domain.entities.commission_payment import CommissionPayment  # noqa: E402
from app.domain.entities.service_agenda import Appointment  # noqa: E402
from app.domain.entities.user import Role, User  # noqa: E402
from app.infrastructure.database import SessionLocal  # noqa: E402
import app.infrastructure.database.init_db  # noqa: E402,F401  (registra todos los modelos)
import app.infrastructure.database.migrations.add_from_cash_to_commissions as migration  # noqa: E402

# Misma marca que usa la pantalla para reconocer un pago "por servicios".
TICKET_PAYMENT_NOTE = "desde Historial de tickets"


def money(value: float) -> str:
    return f"Bs {value:,.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="guardar los cambios (sin esto solo se muestra el plan)")
    parser.add_argument("--fecha", help="día (YYYY-MM-DD) que se pone como fecha del pago; por defecto ayer")
    parser.add_argument("--usuario", help="usuario que figura como quien pagó; por defecto el primer SuperAdmin/Admin")
    args = parser.parse_args()

    # Las columnas nuevas (from_cash) deben existir antes de leer/escribir pagos.
    migration.upgrade()

    db = SessionLocal()
    try:
        if args.usuario:
            payer = db.query(User).filter(User.username == args.usuario).first()
        else:
            payer = (
                db.query(User).join(Role, Role.id == User.role_id)
                .filter(Role.name.in_(["SuperAdmin", "Admin"]))
                .order_by(User.id).first()
            )
        if payer is None:
            print("No encontré el usuario que figurará como pagador (usa --usuario).")
            return 1

        pay_day = date.fromisoformat(args.fecha) if args.fecha else date.today() - timedelta(days=1)
        stamp = datetime.combine(pay_day, time(12, 0))

        linked_ids = {row[0] for row in db.query(Appointment.commission_payment_id)
                      .filter(Appointment.commission_payment_id.isnot(None)).distinct()}
        orphan_payments = [p for p in db.query(CommissionPayment).all() if p.id not in linked_ids]

        pending = (
            db.query(Appointment)
            .filter(Appointment.status == "completed", Appointment.pagado.is_(False), Appointment.professional_id.isnot(None))
            .all()
        )
        by_professional: dict[int, list[tuple[Appointment, float]]] = defaultdict(list)
        for appt in pending:
            commission = appointment_commission(appt)
            if commission > 0:
                by_professional[appt.professional_id].append((appt, commission))

        print(f"Pagador: {payer.username} · fecha del pago: {pay_day.isoformat()}\n")
        print(f"Pagos manuales / antiguos a borrar: {len(orphan_payments)}")
        for p in orphan_payments:
            print(f"  - #{p.id}  {money(p.amount)}  {p.registered_at:%Y-%m-%d}  {p.notes or ''}")
        grand_total = 0.0
        print(f"\nOperarias con servicios completados sin pagar: {len(by_professional)}")
        for professional_id, rows in by_professional.items():
            name = db.get(User, professional_id).username
            total = round(sum(c for _, c in rows), 2)
            grand_total += total
            print(f"  - {name}: {len(rows)} servicio(s) · {money(total)}")
        print(f"\nTotal a dejar como pagado: {money(round(grand_total, 2))}")

        if not args.apply:
            print("\n(Plan solamente: no se cambió nada. Para aplicarlo agrega --apply)")
            return 0

        for p in orphan_payments:
            db.delete(p)
        db.flush()

        for professional_id, rows in by_professional.items():
            amount = round(sum(c for _, c in rows), 2)
            name = db.get(User, professional_id).username
            payment = CommissionPayment(
                professional_id=professional_id,
                amount=amount,
                period_start=min(a.start_time for a, _ in rows).date().isoformat(),
                period_end=max(a.start_time for a, _ in rows).date().isoformat(),
                notes=f"Pago de {len(rows)} ticket(s) {TICKET_PAYMENT_NOTE} (regularización de datos de prueba)",
                registered_at=stamp,
                registered_by_id=payer.id,
                from_cash=False,
            )
            db.add(payment)
            db.flush()
            for appt, commission in rows:
                appt.pagado = True
                appt.pagado_en = stamp
                appt.pagado_por = payer.id
                appt.pagado_monto = commission
                appt.commission_payment_id = payment.id
            db.add(AuditLog(
                user_id=payer.id,
                branch_id=None,
                action="pay",
                entity_type="commission_payment",
                entity_id=payment.id,
                description=f"Regularizó como pagada la comisión de {len(rows)} ticket(s) a '{name}' ({money(amount)}) — datos de prueba",
            ))
        db.commit()
        print("\nListo: cambios guardados.")

        remaining = (
            db.query(Appointment)
            .filter(Appointment.status == "completed", Appointment.pagado.is_(False), Appointment.professional_id.isnot(None))
            .all()
        )
        still = sum(1 for a in remaining if appointment_commission(a) > 0)
        print(f"Servicios completados con comisión aún sin pagar: {still}")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
