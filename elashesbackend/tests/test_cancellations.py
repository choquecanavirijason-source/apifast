"""Cancelar un ticket o una venta: motivo obligatorio, decisión sobre el dinero y registro (quién, por qué).

  - sin motivo (o muy corto) no se cancela;
  - si ya se cobró, hay que indicar si se devuelve el dinero;
  - dinero devuelto: el cobro baja y sale del cuadre de caja;
  - dinero NO devuelto: el cobro se mantiene (el dinero sigue en caja) para que el cuadre cuadre;
  - todo queda en la tabla de cancelaciones y en Auditoría.

Ejecutar:
  cd elashesbackend
  pytest tests/test_cancellations.py -v
"""
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.expense import Expense  # noqa: F401  (registra la tabla para el detalle de caja)
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.ticket_cancellation import TicketCancellation
from tests.test_service_combos import _paid, create_combo, work  # noqa: F401  (work es una fixture)

REASON = "La clienta esperó demasiado y se fue"


def cancel_ticket(work, appointment_id, **body):
    return work.api.put(f"/agenda/appointments/{appointment_id}", json={"status": "cancelled", **body})


def paid_amounts(work, sale_id):
    work.db.expire_all()
    sale = work.db.get(PosSale, sale_id)
    return [p.amount for p in sale.payments if p.status == "paid"]


def audits(work, entity):
    work.db.expire_all()
    return work.db.query(AuditLog).filter(AuditLog.action == "cancel", AuditLog.entity_type == entity).all()


def test_cancel_requires_a_reason(work):
    sale = _paid(work, [work.lifting])
    aid = sale["appointments"][0]["id"]
    for body in ({}, {"cancel_reason": ""}, {"cancel_reason": "no"}):
        res = cancel_ticket(work, aid, refund=True, **body)
        assert res.status_code == 400 and "motivo" in res.json()["detail"]
    assert paid_amounts(work, sale["id"]) == [220]          # nada cambió


def test_cancel_a_paid_ticket_requires_the_refund_decision(work):
    sale = _paid(work, [work.lifting])
    res = cancel_ticket(work, sale["appointments"][0]["id"], cancel_reason=REASON)
    assert res.status_code == 400 and "devuelve el dinero" in res.json()["detail"]
    assert paid_amounts(work, sale["id"]) == [220]


def test_refunded_cancellation_removes_the_money_from_the_cash_count(work):
    sale = _paid(work, [work.lifting])
    res = cancel_ticket(work, sale["appointments"][0]["id"], cancel_reason=REASON, refund=True)
    assert res.status_code == 200
    assert paid_amounts(work, sale["id"]) == [0]
    row = work.db.query(TicketCancellation).one()
    assert (row.amount, row.refunded, row.scope, row.reason) == (220, True, "ticket", REASON)
    assert row.user_id is not None and row.sale_id == sale["id"]
    log = audits(work, "appointment")[-1].description
    assert REASON in log and "devuelto" in log and "220.00" in log


def test_not_refunded_cancellation_keeps_the_money_in_the_cash_count(work):
    sale = _paid(work, [work.lifting])
    assert cancel_ticket(work, sale["appointments"][0]["id"], cancel_reason=REASON, refund=False).status_code == 200
    assert paid_amounts(work, sale["id"]) == [220]          # el dinero sigue en caja
    row = work.db.query(TicketCancellation).one()
    assert (row.amount, row.refunded) == (220, False)
    assert "NO devuelto" in audits(work, "appointment")[-1].description


def test_partial_cancellation_keeps_the_rest_and_the_retained_part(work):
    sale = _paid(work, [work.lifting, work.clasicas])        # 220 + 280 = 500
    lifting = next(a for a in sale["appointments"] if a["service_id"] == work.lifting)
    cancel_ticket(work, lifting["id"], cancel_reason=REASON, refund=False)
    assert paid_amounts(work, sale["id"]) == [500]           # 280 que sigue vigente + 220 retenidos
    clasicas = next(a for a in sale["appointments"] if a["service_id"] == work.clasicas)
    cancel_ticket(work, clasicas["id"], cancel_reason=REASON, refund=True)
    assert paid_amounts(work, sale["id"]) == [220]           # se devolvió lo de Clásicas; lo de Lifting sigue retenido


def test_cancelling_a_promotion_ticket_without_refund_keeps_what_was_paid(work):
    combo_id = create_combo(work, price=450).json()["id"]
    sale = _paid(work, [work.lifting, work.clasicas], [{"combo_id": combo_id}])    # pagó 450
    lifting = next(a for a in sale["appointments"] if a["service_id"] == work.lifting)
    cancel_ticket(work, lifting["id"], cancel_reason=REASON, refund=False)
    assert paid_amounts(work, sale["id"]) == [450]


def test_cancel_a_whole_sale_needs_a_reason_and_a_refund_decision(work):
    sale = _paid(work, [work.lifting])
    url = f"/pos-sales/{sale['id']}/cancel"
    assert work.api.post(url, json={}).status_code == 422
    assert work.api.post(url, json={"reason": "no"}).status_code == 400
    res = work.api.post(url, json={"reason": REASON})
    assert res.status_code == 400 and "devuelve el dinero" in res.json()["detail"]


def test_cancel_a_whole_sale_refunding(work):
    sale = _paid(work, [work.lifting])
    res = work.api.post(f"/pos-sales/{sale['id']}/cancel", json={"reason": REASON, "refund": True})
    assert res.status_code == 200 and res.json()["status"] == "cancelled"
    assert paid_amounts(work, sale["id"]) == []              # los pagos se cancelan: salen del cuadre
    row = work.db.query(TicketCancellation).one()
    assert (row.scope, row.amount, row.refunded) == ("sale", 220, True)
    assert REASON in audits(work, "pos_sale")[-1].description


def test_cancel_a_whole_sale_without_refund_keeps_the_money(work):
    sale = _paid(work, [work.lifting, work.clasicas])
    res = work.api.post(f"/pos-sales/{sale['id']}/cancel", json={"reason": REASON, "refund": False})
    assert res.status_code == 200 and res.json()["status"] == "cancelled"
    assert paid_amounts(work, sale["id"]) == [500]           # lo cobrado se queda en caja
    row = work.db.query(TicketCancellation).one()
    assert (row.amount, row.refunded) == (500, False)


def test_cash_session_detail_lists_the_cancellations_of_the_shift(work):
    from app.domain.entities.cash_close import CashClose
    from app.presentation.controllers import cash_session_controller

    work.api.app.include_router(cash_session_controller.router)
    sale = _paid(work, [work.lifting, work.clasicas])
    lifting = next(a for a in sale["appointments"] if a["service_id"] == work.lifting)
    cancel_ticket(work, lifting["id"], cancel_reason=REASON, refund=True)
    clasicas = next(a for a in sale["appointments"] if a["service_id"] == work.clasicas)
    cancel_ticket(work, clasicas["id"], cancel_reason="Cobro duplicado de prueba", refund=False)

    session_id = work.db.query(CashClose).first().id
    detail = work.api.get(f"/cash-sessions/{session_id}/detail")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert len(body["cancellations"]) == 2
    assert body["refunds_total"] == 220                      # solo lo devuelto sale de la caja
    by_reason = {c["reason"]: c for c in body["cancellations"]}
    assert by_reason[REASON]["refunded"] is True and by_reason[REASON]["amount"] == 220
    assert by_reason["Cobro duplicado de prueba"]["refunded"] is False
    assert by_reason[REASON]["user_name"] == "admin"
    # y el efectivo esperado: solo cuenta lo que sigue cobrado (280 de Clásicas, retenidos)
    assert body["income_by_method"]["efectivo"] == 280


# ── Regla del cliente: en servicio o finalizado, ya no se cancela ─────────────

def set_status(work, appointment_id, status):
    res = work.api.put(f"/agenda/appointments/{appointment_id}", json={"status": status})
    assert res.status_code == 200, res.text


def test_an_in_service_ticket_cannot_be_cancelled(work):
    sale = _paid(work, [work.lifting])
    aid = sale["appointments"][0]["id"]
    set_status(work, aid, "in_service")
    res = cancel_ticket(work, aid, cancel_reason=REASON, refund=True)
    assert res.status_code == 409 and "no se puede cancelar" in res.json()["detail"]
    assert paid_amounts(work, sale["id"]) == [220]          # nada cambió
    assert work.db.query(TicketCancellation).count() == 0


def test_a_finished_ticket_cannot_be_cancelled(work):
    sale = _paid(work, [work.lifting])
    aid = sale["appointments"][0]["id"]
    set_status(work, aid, "in_service")
    set_status(work, aid, "completed")
    res = cancel_ticket(work, aid, cancel_reason=REASON, refund=True)
    assert res.status_code == 409
    assert paid_amounts(work, sale["id"]) == [220]


def test_the_rule_wins_over_missing_reason(work):
    sale = _paid(work, [work.lifting])
    aid = sale["appointments"][0]["id"]
    set_status(work, aid, "in_service")
    res = cancel_ticket(work, aid)                           # sin motivo ni decisión
    assert res.status_code == 409 and "no se puede cancelar" in res.json()["detail"]


def test_a_waiting_ticket_can_still_be_cancelled(work):
    sale = _paid(work, [work.lifting])
    assert cancel_ticket(work, sale["appointments"][0]["id"], cancel_reason=REASON, refund=True).status_code == 200


def test_a_sale_with_a_started_ticket_cannot_be_cancelled(work):
    sale = _paid(work, [work.lifting, work.clasicas])
    set_status(work, sale["appointments"][0]["id"], "in_service")
    res = work.api.post(f"/pos-sales/{sale['id']}/cancel", json={"reason": REASON, "refund": True})
    assert res.status_code == 409 and "No se puede cancelar la venta" in res.json()["detail"]
    work.db.expire_all()
    assert work.db.get(PosSale, sale["id"]).status == "paid"


def test_a_sale_with_only_waiting_tickets_can_still_be_cancelled(work):
    sale = _paid(work, [work.lifting, work.clasicas])
    res = work.api.post(f"/pos-sales/{sale['id']}/cancel", json={"reason": REASON, "refund": True})
    assert res.status_code == 200 and res.json()["status"] == "cancelled"


def test_a_finished_ticket_stays_finished(work):
    sale = _paid(work, [work.lifting])
    aid = sale["appointments"][0]["id"]
    set_status(work, aid, "in_service")
    set_status(work, aid, "completed")
    for target in ("in_service", "pending", "waiting"):
        res = work.api.put(f"/agenda/appointments/{aid}", json={"status": target})
        assert res.status_code == 409 and "ya no se puede mover" in res.json()["detail"]
    # repetir "finalizado" no cambia nada y no da error; otros datos del ticket siguen editables
    assert work.api.put(f"/agenda/appointments/{aid}", json={"status": "completed"}).status_code == 200
    detail = work.api.get(f"/agenda/appointments/{aid}").json()
    assert detail["status"] == "completed"
