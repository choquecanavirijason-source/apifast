"""
Pago de comisiones por ticket (Comisiones por operaria > Historial de tickets).

- pay_commissions: marca un lote de tickets como pagados, todo o nada. Por cada
  operaria crea un CommissionPayment (el mismo registro que usa la pestaña
  "Comisiones y pagos") con la suma de sus tickets, y enlaza cada ticket.
- void_commission_payment: anula el pago de un ticket y descuenta su monto del
  CommissionPayment (lo borra si queda en cero).

La auditoría se escribe en la MISMA transacción (AuditLog directo): record_audit
hace su propio commit y rompería el "todo o nada".
"""
from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import resolve_branch_id
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.commission_payment import CommissionPayment
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.user import User
from app.presentation.schemas.reports import DEFAULT_COMMISSION_RATE

MAX_BATCH = 500
_CENT = 0.005


def appointment_commission(appt: Appointment) -> float:
    """Comisión del ticket, con la misma regla que el Cierre de Caja
    (reports_controller): tasa del servicio, o la de la operaria si el
    servicio no tiene. Solo cuenta si el ticket está completado."""
    if appt.status != "completed":
        return 0.0
    prof_rate = (
        appt.professional.commission_rate
        if appt.professional and appt.professional.commission_rate is not None
        else DEFAULT_COMMISSION_RATE
    )
    services = [s.service for s in sorted(appt.appointment_services, key=lambda x: x.sort_order) if s.service]
    if not services and appt.service:
        services = [appt.service]
    total = sum(
        (svc.price or 0.0) * (svc.commission_rate if svc.commission_rate is not None else prof_rate)
        for svc in services
    )
    return round(total, 2)


def _lock_appointments(db: Session, ids: list[int]) -> list[Appointment]:
    # FOR UPDATE sin joins (Postgres rechaza FOR UPDATE con LEFT OUTER JOIN):
    # servicios y operaria se cargan después, sin bloqueo.
    return (
        db.query(Appointment)
        .filter(Appointment.id.in_(ids))
        .with_for_update(of=Appointment)
        .all()
    )


def _ticket_label(appt: Appointment) -> str:
    return appt.ticket_code or f"#{appt.id}"


def pay_commissions(db: Session, appointment_ids: list[int], user: User) -> dict:
    ids = list(dict.fromkeys(appointment_ids))
    if not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No hay tickets seleccionados.")
    if len(ids) > MAX_BATCH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo {MAX_BATCH} tickets por lote.",
        )

    found = {a.id: a for a in _lock_appointments(db, ids)}
    errors: list[dict] = []
    other_branch = False
    commissions: dict[int, float] = {}
    for appointment_id in ids:
        appt = found.get(appointment_id)
        if appt is None:
            errors.append({"id": appointment_id, "motivo": "El ticket no existe."})
            continue
        if resolve_branch_id(appt.branch_id, user) != appt.branch_id:
            other_branch = True
            errors.append({"id": appointment_id, "motivo": "El ticket es de otra sucursal."})
            continue
        if appt.pagado:
            errors.append({"id": appointment_id, "motivo": "La comisión ya estaba pagada."})
            continue
        if appt.status != "completed":
            errors.append({"id": appointment_id, "motivo": "El ticket no está completado."})
            continue
        if appt.professional_id is None:
            errors.append({"id": appointment_id, "motivo": "El ticket no tiene operaria asignada."})
            continue
        commission = appointment_commission(appt)
        if commission <= 0:
            errors.append({"id": appointment_id, "motivo": "El ticket no tiene comisión."})
            continue
        commissions[appointment_id] = commission

    if errors:
        db.rollback()  # suelta los bloqueos; no se guardó nada
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if other_branch else status.HTTP_409_CONFLICT,
            detail={"message": "No se registró ningún pago: revisa los tickets marcados.", "errores": errors},
        )

    now = datetime.utcnow()
    by_professional: dict[int, list[Appointment]] = defaultdict(list)
    for appointment_id in ids:
        appt = found[appointment_id]
        by_professional[appt.professional_id].append(appt)

    paid: list[dict] = []
    total = 0.0
    for professional_id, appts in by_professional.items():
        amount = round(sum(commissions[a.id] for a in appts), 2)
        days = sorted(a.start_time.date().isoformat() for a in appts)
        payment = CommissionPayment(
            professional_id=professional_id,
            amount=amount,
            period_start=days[0],
            period_end=days[-1],
            notes=f"Pago de {len(appts)} ticket(s) desde Historial de tickets",
            registered_at=now,
            registered_by_id=user.id,
        )
        db.add(payment)
        db.flush()

        for appt in appts:
            appt.pagado = True
            appt.pagado_en = now
            appt.pagado_por = user.id
            appt.pagado_monto = commissions[appt.id]
            appt.commission_payment_id = payment.id
            paid.append({
                "id": appt.id,
                "pagado_en": now,
                "pagado_por": user.id,
                "pagado_monto": commissions[appt.id],
                "commission_payment_id": payment.id,
            })

        professional_name = appts[0].professional.username if appts[0].professional else f"#{professional_id}"
        branch_ids = {a.branch_id for a in appts}
        db.add(AuditLog(
            user_id=user.id,
            branch_id=branch_ids.pop() if len(branch_ids) == 1 else None,
            action="pay",
            entity_type="commission_payment",
            entity_id=payment.id,
            description=(
                f"Pagó la comisión de {len(appts)} ticket(s) a '{professional_name}' "
                f"(Bs {amount:.2f}): {', '.join(_ticket_label(a) for a in appts)}"
            ),
        ))
        total += amount

    db.commit()
    return {
        "pagados": paid,
        "tickets": len(paid),
        "operarias": len(by_professional),
        "total": round(total, 2),
        "pagado_por_nombre": user.username,
    }


def void_commission_payment(
    db: Session, appointment_id: int, user: User, motivo: Optional[str] = None
) -> Appointment:
    appt = _lock_appointments(db, [appointment_id])
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    appt = appt[0]
    if resolve_branch_id(appt.branch_id, user) != appt.branch_id:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El ticket es de otra sucursal.")
    if not appt.pagado:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La comisión de este ticket no está pagada.")

    amount = appt.pagado_monto or 0.0
    payment_id = appt.commission_payment_id
    payment: Optional[CommissionPayment] = None
    if payment_id is not None:
        payment = (
            db.query(CommissionPayment)
            .filter(CommissionPayment.id == payment_id)
            .with_for_update()
            .first()
        )

    appt.pagado = False
    appt.pagado_en = None
    appt.pagado_por = None
    appt.pagado_monto = None
    appt.commission_payment_id = None
    if payment is not None:
        payment.amount = round(payment.amount - amount, 2)
        if payment.amount < _CENT:
            db.delete(payment)

    professional_name = appt.professional.username if appt.professional else "sin operaria"
    description = (
        f"Anuló el pago de comisión del ticket {_ticket_label(appt)} "
        f"('{professional_name}', Bs {amount:.2f})"
    )
    if motivo:
        description += f". Motivo: {motivo}"
    db.add(AuditLog(
        user_id=user.id,
        branch_id=appt.branch_id,
        action="void",
        entity_type="commission_payment",
        entity_id=payment_id,
        description=description,
    ))
    db.commit()
    db.refresh(appt)
    return appt


def unmark_tickets_of_payment(db: Session, payment_id: int) -> int:
    """Al eliminar un CommissionPayment desde "Comisiones y pagos", sus tickets
    vuelven a quedar sin pagar (si no, seguirían marcados con un pago que ya
    no existe). No hace commit: va en la misma transacción del borrado."""
    return (
        db.query(Appointment)
        .filter(Appointment.commission_payment_id == payment_id)
        .update(
            {
                Appointment.pagado: False,
                Appointment.pagado_en: None,
                Appointment.pagado_por: None,
                Appointment.pagado_monto: None,
                Appointment.commission_payment_id: None,
            },
            synchronize_session=False,
        )
    )
