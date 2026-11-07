"""Removal tab reuses real reminder endpoints with synthetic data/providers."""
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_retouch_reminders import scenario  # shared isolated DB + fake SMTP/FCM
from app.application.services.appointment_notice_service import LA_PAZ
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.tracking import Tracking


def configure(scenario, enabled=True, days=21):
    api,factory,ids,auth,_,_=scenario
    headers=auth()
    assert api.put('/services/categories/1',headers=headers,json={'has_removal':enabled}).status_code==200
    assert api.put('/agenda/services/1',headers=headers,json={'removal_days':days}).status_code==200
    # Recalculate through the supported tracking update, not direct date inserts.
    for tid in ids:
        with factory() as db:
            applied=db.get(Tracking,tid).last_application_date.replace(tzinfo=timezone.utc).isoformat()
        response=api.put(f'/tracking/{tid}',headers=headers,json={'last_application_date':applied})
        assert response.status_code==200,response.text
    return headers


def rows(api,headers,kind='retiro',**params):
    response=api.get('/clients/retoques',headers=headers,params={'tipo':kind,**params})
    assert response.status_code==200,response.text
    return response.json()


def path(tid):return f'/clients/retoques/{tid}/recordatorio/retiro'


def later_appointment(scenario,headers,tracking_id,with_tracking=False):
    api,factory,_,_,_,_=scenario
    with factory() as db:
        original=db.get(Tracking,tracking_id)
        cid,bid=original.client_id,original.branch_id
    service=api.post('/agenda/services',headers=headers,json={
        'name':'Retiro de extensiones FICTICIO','category_id':1,'duration_minutes':30,'price':50,
        'maintenance_days':None,'removal_days':None}).json()
    start=(datetime.now(LA_PAZ)-timedelta(days=1)).replace(hour=11,minute=0,second=0,microsecond=0)
    appointment=api.post('/agenda/appointments',headers=headers,json={
        'client_id':cid,'branch_id':bid,'service_id':service['id'],
        'start_time':start.replace(tzinfo=None).isoformat(),
        'end_time':(start+timedelta(minutes=30)).replace(tzinfo=None).isoformat()})
    assert appointment.status_code==201,appointment.text
    aid=appointment.json()['id']
    assert api.put(f'/agenda/appointments/{aid}',headers=headers,json={'status':'completed'}).status_code==200
    if with_tracking:
        response=api.post('/tracking/',headers=headers,json={
            'client_id':cid,'branch_id':bid,'appointment_id':aid,
            'last_application_date':start.astimezone(timezone.utc).isoformat()})
        assert response.status_code==201,response.text
    return cid


def test_upcoming_overdue_application_date_and_separate_categories(scenario):
    api,_,_,_,_,_=scenario
    headers=configure(scenario)
    removal=rows(api,headers)
    maintenance=rows(api,headers,'mantenimiento')
    assert len(removal)==len(maintenance)==3
    assert {r['tipo'] for r in removal}=={'retiro'}
    assert {r['tipo'] for r in maintenance}=={'mantenimiento'}
    assert sorted(r['dias_restantes'] for r in removal)==[-3,5,5]
    assert all(r['fecha_aplicacion'] and r['estado_retiro']=='por_verificar' for r in removal)
    assert len({(r['seguimiento_id'],r['tipo']) for r in removal})==3
    for r in removal:
        applied=datetime.fromisoformat(r['fecha_aplicacion']).date()
        target=datetime.fromisoformat(r['fecha_objetivo']).date()
        assert (target-applied).days==21
    assert len(rows(api,headers,dias=2))==1  # only the overdue removal


@pytest.mark.parametrize('enabled,days',[(False,21),(True,None)])
def test_unconfigured_removal_is_not_listed(scenario,enabled,days):
    api,_,_,_,_,_=scenario
    headers=configure(scenario,enabled,days)
    assert rows(api,headers)==[]
    assert len(rows(api,headers,'mantenimiento'))==3


def test_completed_removal_with_new_followup_supersedes_old_without_deleting_history(scenario):
    api,factory,ids,_,outbox,pushes=scenario
    headers=configure(scenario)
    cid=later_appointment(scenario,headers,ids[0],with_tracking=True)
    assert not any(row['client_id']==cid for row in rows(api,headers))
    assert api.get(path(ids[0]),headers=headers).status_code==409
    with factory() as db:
        assert db.query(Tracking).filter_by(client_id=cid).count()==2
        assert db.get(Tracking,ids[0]).next_removal_date is not None
    assert not outbox and not pushes


def test_completed_attendance_without_followup_is_unknown_and_cannot_send(scenario):
    api,_,ids,_,outbox,pushes=scenario
    headers=configure(scenario)
    preview=api.get(path(ids[0]),headers=headers).json()
    cid=later_appointment(scenario,headers,ids[0])
    row=next(r for r in rows(api,headers) if r['client_id']==cid)
    assert row['estado_retiro']=='atencion_posterior'
    assert row['recordatorio_permitido'] is False
    assert 'verifica' in row['observacion']
    mixed=api.get('/clients/retoques',headers=headers).json()
    assert next(r for r in mixed if r['client_id']==cid and r['tipo']=='retiro')['recordatorio_permitido'] is False
    assert next(r for r in mixed if r['client_id']==cid and r['tipo']=='mantenimiento')['recordatorio_permitido'] is True
    assert api.get(path(ids[0]),headers=headers).status_code==409
    response=api.post(path(ids[0]),headers=headers,json={
        'preview_version':preview['preview_version'],'send_push':True,'send_email':True})
    assert response.status_code==409
    assert not outbox and not pushes


def test_future_appointment_is_not_a_confirmed_removal(scenario):
    api,_,ids,_,_,_=scenario
    headers=configure(scenario)
    p=api.get(path(ids[1]),headers=headers).json()
    assert p['appointment_state']=='no_verificada'
    assert 'no se ha verificado que sea de retiro' in p['appointment_note']
    assert 'consulta con tu sucursal' in p['message']


@pytest.mark.parametrize('username,expected_rows,preview_code',[
    ('other_demo',0,403),('no_branch',0,403),('reader_demo',3,403),('own_demo',3,200)])
def test_permissions_and_branch_scope(scenario,username,expected_rows,preview_code):
    api,_,ids,auth,_,_=scenario
    configure(scenario)
    headers=auth(username)
    assert len(rows(api,headers))==expected_rows
    assert api.get(path(ids[0]),headers=headers).status_code==preview_code
    if expected_rows==0:
        assert rows(api,headers,branch_id=1)==[]


def test_other_branch_history_and_future_appointments_are_not_exposed(scenario):
    api,factory,ids,_,_,_=scenario
    headers=configure(scenario)
    with factory() as db:
        tid=ids[0];tracking=db.get(Tracking,tid);cid=tracking.client_id
        start=(datetime.now(LA_PAZ)+timedelta(days=1)).replace(tzinfo=None)
        db.add(Appointment(client_id=cid,branch_id=2,service_id=1,
                           start_time=start,end_time=start+timedelta(hours=1),status='confirmed'))
        db.commit()
    # Branch 1 (where the attention was done) never sees branch 2's booking date;
    # the pending booking only blocks the reminder there, without details.
    row=next(r for r in rows(api,headers,branch_id=1) if r['seguimiento_id']==tid)
    assert row['proxima_cita'] is None and row['recordatorio_permitido'] is False
    assert row['observacion']=='Hay una cita pendiente de atención; el recordatorio se habilita al finalizarla.'
    assert all(r['seguimiento_id'] is not None for r in rows(api,headers,branch_id=1) if r['client_id']==cid)
    # Branch 2 sees its own booking as pending, never the branch 1 tracking.
    other=[r for r in rows(api,headers,branch_id=2) if r['client_id']==cid]
    assert [r['estado_seguimiento'] for r in other]==['pendiente_atencion'] and other[0]['seguimiento_id'] is None
    with factory() as db:
        db.get(Tracking,tid).branch_id=2;db.commit()
    # Tracking branch no longer matches its attention's branch: incoherent, hidden everywhere.
    for scope in ({},{'branch_id':1},{'branch_id':2}):
        assert not any(r['seguimiento_id']==tid for r in rows(api,headers,**scope))


def test_removal_uses_consent_and_persistent_dedup_independent_of_maintenance(scenario):
    api,factory,ids,_,outbox,pushes=scenario
    headers=configure(scenario)
    tid=ids[0]
    from app.domain.entities.client import Client
    with factory() as db:
        cid=db.get(Tracking,tid).client_id
        db.get(Client,cid).notificaciones_activas=False;db.commit()
    p=api.get(path(tid),headers=headers).json()
    assert p['consent'] is False
    assert api.post(path(tid),headers=headers,json={'preview_version':p['preview_version'],'send_push':True}).status_code==409
    with factory() as db:
        db.get(Client,cid).notificaciones_activas=True;db.commit()
    ids_sent=[]
    for kind in ('mantenimiento','retiro'):
        url=f'/clients/retoques/{tid}/recordatorio/{kind}'
        p=api.get(url,headers=headers).json()
        payload={'preview_version':p['preview_version'],'send_push':True,'send_email':True}
        first=api.post(url,headers=headers,json=payload)
        assert first.status_code==200,first.text
        ids_sent.append(first.json()['broadcast_id'])
        for _ in range(3):
            assert api.post(url,headers=headers,json=payload).json()['broadcast_id']==ids_sent[-1]
        result=api.get(url,headers=headers).json()['result']
        assert result['push_status']==result['email_status']=='sent'
    assert ids_sent[0]!=ids_sent[1]
    assert len(outbox)==len(pushes)==2


def test_invalid_type_rejected(scenario):
    api,_,_,auth,_,_=scenario
    assert api.get('/clients/retoques?tipo=inventado',headers=auth()).status_code==422
