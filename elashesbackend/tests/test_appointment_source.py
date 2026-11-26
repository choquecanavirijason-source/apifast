"""Origen del ticket: la Agenda solo muestra reservas; las ventas directas del POS (mostrador) no.

  - venta para atender ahora            -> "mostrador"
  - «Agendar reserva» (reservation_only) -> "reserva"
  - venta del POS programada para luego  -> "reserva"
  - ticket creado desde la Agenda        -> "reserva"
  - mover un ticket a un horario futuro  -> pasa a "reserva"
  - mover un ticket a «ahora» («Llegó»)  -> conserva su origen

Ejecutar:
  cd elashesbackend
  pytest tests/test_appointment_source.py -v
"""
from datetime import timedelta

from app.core.appointment_source import local_now, naive_clock, source_for_start
from tests.test_service_combos import work  # noqa: F401  (fixture)


def sale(work, start, *, reservation_only=False):
    body = {
        "branch_id": work.branch,
        "payment_method": "cash",
        "cash_received": 1000,
        "items": [{"service_id": work.lifting, "branch_id": work.branch,
                   "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}],
    }
    if reservation_only:
        body["reservation_only"] = True
        body.pop("cash_received")
    res = work.api.post("/pos-sales/", json=body)
    assert res.status_code == 201, res.text
    return res.json()["appointments"][0]


def test_a_sale_for_right_now_is_counter(work):
    assert sale(work, local_now())["source"] == "mostrador"
    assert sale(work, local_now() + timedelta(minutes=20))["source"] == "mostrador"


def test_a_sale_scheduled_for_later_is_a_reservation(work):
    assert sale(work, local_now() + timedelta(hours=3))["source"] == "reserva"


def test_reserving_from_the_counter_is_a_reservation_even_if_it_is_for_now(work):
    assert sale(work, local_now(), reservation_only=True)["source"] == "reserva"


def test_a_ticket_created_from_the_agenda_is_a_reservation(work):
    from app.domain.entities.client import Client
    from app.domain.entities.service_agenda import Appointment

    client = Client(name="Ana", last_name="Prueba", branch_id=work.branch)
    work.db.add(client)
    work.db.flush()
    start = local_now()
    res = work.api.post("/agenda/appointments", json={
        "client_id": client.id, "service_id": work.lifting, "branch_id": work.branch,
        "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat(),
    })
    assert res.status_code == 201, res.text
    assert res.json()["source"] == "reserva"
    assert work.db.get(Appointment, res.json()["id"]).source == "reserva"


def test_moving_a_counter_ticket_to_a_future_slot_makes_it_a_reservation(work):
    appt = sale(work, local_now())
    assert appt["source"] == "mostrador"
    later = local_now() + timedelta(hours=4)
    res = work.api.put(f"/agenda/appointments/{appt['id']}", json={
        "start_time": later.isoformat(), "end_time": (later + timedelta(hours=1)).isoformat(),
        "skip_availability_check": True,
    })
    assert res.status_code == 200, res.text
    assert res.json()["source"] == "reserva"


def test_moving_a_reservation_to_now_keeps_it_a_reservation(work):
    appt = sale(work, local_now() + timedelta(hours=4))
    assert appt["source"] == "reserva"
    now = local_now()
    res = work.api.put(f"/agenda/appointments/{appt['id']}", json={
        "start_time": now.isoformat(), "end_time": (now + timedelta(hours=1)).isoformat(),
        "skip_availability_check": True,
    })
    assert res.status_code == 200, res.text
    assert res.json()["source"] == "reserva"        # «Llegó»: sigue siendo de la Agenda


def test_the_classification_helper_handles_aware_datetimes():
    from datetime import timezone

    aware = local_now().replace(tzinfo=timezone.utc) + timedelta(hours=5)
    assert naive_clock(aware).tzinfo is None
    assert source_for_start(aware) == "reserva"


def test_reservation_arrival_is_marked_and_undone(work):
    ticket = sale(work, local_now() + timedelta(hours=3))
    assert ticket["source"] == "reserva" and ticket["arrived_at"] is None
    r = work.api.put(f"/agenda/appointments/{ticket['id']}", json={"arrived": True})
    assert r.status_code == 200, r.text
    assert r.json()["arrived_at"] is not None and r.json()["source"] == "reserva"
    r = work.api.put(f"/agenda/appointments/{ticket['id']}", json={"arrived": False})
    assert r.json()["arrived_at"] is None


def test_group_ticket_can_be_split_into_one_per_service(work):
    start = local_now() + timedelta(hours=3)
    body = {"branch_id": work.branch, "payment_method": "cash", "reservation_only": True,
            "items": [{"service_ids": [work.lifting, work.clasicas], "branch_id": work.branch,
                       "start_time": start.isoformat(), "end_time": (start + timedelta(hours=3)).isoformat()}]}
    res = work.api.post("/pos-sales/", json=body)
    assert res.status_code == 201, res.text
    group = res.json()["appointments"][0]
    assert len(group["service_ids"]) == 2

    split = work.api.post(f"/agenda/appointments/{group['id']}/split")
    assert split.status_code == 200, split.text
    tickets = split.json()
    assert len(tickets) == 2 and tickets[0]["id"] == group["id"]
    assert [t["service_ids"] for t in tickets] == [[work.lifting], [work.clasicas]]
    assert tickets[1]["start_time"] == tickets[0]["end_time"]
    assert {t["sale_id"] for t in tickets} == {group["sale_id"]} and {t["source"] for t in tickets} == {"reserva"}

    again = work.api.post(f"/agenda/appointments/{group['id']}/split")
    assert again.status_code == 409


def test_split_tickets_can_be_merged_back(work):
    start = local_now() + timedelta(hours=3)
    body = {"branch_id": work.branch, "payment_method": "cash", "reservation_only": True,
            "items": [{"service_ids": [work.lifting, work.clasicas], "branch_id": work.branch,
                       "start_time": start.isoformat(), "end_time": (start + timedelta(hours=4)).isoformat()}]}
    group = work.api.post("/pos-sales/", json=body).json()["appointments"][0]
    parts = work.api.post(f"/agenda/appointments/{group['id']}/split").json()
    assert len(parts) == 2

    merged = work.api.post(f"/agenda/appointments/{parts[0]['id']}/merge")
    assert merged.status_code == 200, merged.text
    ticket = merged.json()
    assert ticket["id"] == parts[0]["id"] and ticket["service_ids"] == [work.lifting, work.clasicas]
    assert ticket["start_time"] == parts[0]["start_time"]
    assert work.api.get(f"/agenda/appointments/{parts[1]['id']}").status_code == 404
    assert work.api.post(f"/agenda/appointments/{ticket['id']}/merge").status_code == 409
