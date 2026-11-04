"""Minimal reservation contract tests; no service-purpose heuristics."""
import pytest
from datetime import timedelta

from tests.test_removal_notifications import scenario, configure, rows
from app.domain.entities.service_agenda import Appointment


def test_no_future_booking_and_ambiguous_booking(scenario):
    api,_,ids,_,_,_=scenario
    h=configure(scenario)
    result={r['seguimiento_id']:r for r in rows(api,h)}
    assert result[ids[0]]['reserva_retiro_estado']=='sin_reserva'
    bea=result[ids[1]]
    assert bea['reserva_retiro_estado']=='por_verificar'
    assert bea['reserva_retiro_fecha'] is None
    assert 'no está identificado con certeza como retiro' in bea['reserva_retiro_detalle']
    # Even the same extension service is not proof of removal.
    assert not any(r['reserva_retiro_estado']=='reservado' for r in result.values())


@pytest.mark.parametrize('status',['cancelled','completed','no_show'])
def test_final_future_appointment_is_not_a_reservation(scenario,status):
    api,factory,ids,_,_,_=scenario
    h=configure(scenario)
    with factory() as db:
        appointment=db.query(Appointment).filter_by(client_id=2,status='confirmed').one()
        aid=appointment.id
    response=api.put(f'/agenda/appointments/{aid}',headers=h,json={'status':status})
    assert response.status_code==200,response.text
    row=next(r for r in rows(api,h) if r['seguimiento_id']==ids[1])
    assert row['reserva_retiro_estado']=='sin_reserva' and row['proxima_cita'] is None


def test_rescheduling_changes_scoped_future_date_without_claiming_removal(scenario):
    api,factory,ids,_,_,_=scenario
    h=configure(scenario)
    with factory() as db:
        appointment=db.query(Appointment).filter_by(client_id=2,status='confirmed').one()
        aid=appointment.id;start=appointment.start_time+timedelta(days=3,hours=1)
    response=api.put(f'/agenda/appointments/{aid}',headers=h,json={
        'start_time':start.isoformat(),'end_time':(start+timedelta(hours=1)).isoformat()})
    assert response.status_code==200,response.text
    row=next(r for r in rows(api,h) if r['seguimiento_id']==ids[1])
    assert row['proxima_cita']==start.isoformat()
    assert row['reserva_retiro_estado']=='por_verificar'


def test_unclassified_service_named_removal_is_still_ambiguous(scenario):
    api,_,ids,_,_,_=scenario
    h=configure(scenario)
    assert api.put('/agenda/services/2',headers=h,json={'name':'Retiro de extensiones'}).status_code==200
    row=next(r for r in rows(api,h) if r['seguimiento_id']==ids[1])
    assert row['reserva_retiro_estado']=='por_verificar'
