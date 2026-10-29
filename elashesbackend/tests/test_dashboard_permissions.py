"""Dashboard autónomo: no concede permisos de agenda y respeta la sucursal."""
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db
from app.infrastructure.database import Base
from app.core.dependencies import get_db, get_current_active_user
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.payment import Payment
from app.domain.entities.service_agenda import Appointment, Service, BranchService
from app.domain.entities.user import User, Role, Permission
from app.presentation.controllers.dashboard_controller import router as dashboard_router
from app.presentation.controllers.service_agenda_controller import router as agenda_router

PATHS = ["/dashboard/overview", "/dashboard/revenue-series", "/dashboard/service-distribution",
         "/dashboard/inventory-distribution", "/dashboard/filters"]


@pytest.fixture
def scenario():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    home, other = Branch(name="Norte"), Branch(name="Principal")
    role = Role(name="EncargadoAlmacen")
    permission = Permission(name="dashboard:view")
    role.permissions = [permission]
    db.add_all([home, other, role])
    db.flush()
    user = User(username="almacen_test", email="almacen_test@test.com", hashed_password="unused",
                role_id=role.id, branch_id=home.id, is_active=True)
    service = Service(name="Servicio Norte", duration_minutes=60, price=10)
    other_service = Service(name="Servicio Principal", duration_minutes=60, price=900)
    db.add_all([user, service, other_service])
    db.flush()
    db.add_all([BranchService(branch_id=home.id, service_id=service.id),
                BranchService(branch_id=other.id, service_id=other_service.id)])
    for branch, svc, amount in [(home, service, 10), (other, other_service, 900)]:
        client = Client(name=branch.name, last_name="Test", branch_id=branch.id)
        db.add(client)
        db.flush()
        appt = Appointment(client_id=client.id, branch_id=branch.id, service_id=svc.id,
                           start_time=datetime.now(), end_time=datetime.now()+timedelta(hours=1), status="completed")
        db.add(appt)
        db.flush()
        db.add(Payment(client_id=client.id, branch_id=branch.id, appointment_id=appt.id,
                       amount=amount, method="cash", status="paid"))
    db.commit()
    app = FastAPI()
    app.include_router(dashboard_router)
    app.include_router(agenda_router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as api:
        yield api, db, user, home, other
    db.close()
    engine.dispose()


@pytest.mark.parametrize("path", PATHS)
def test_dashboard_view_alone_loads_every_metric_and_filters(scenario, path):
    api, db, user, home, other = scenario
    response = api.get(path)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("path", PATHS)
def test_user_without_dashboard_or_module_permissions_is_denied(scenario, path):
    api, db, user, home, other = scenario
    user.role.permissions = []
    db.commit()
    assert api.get(path).status_code == 403


def test_dashboard_permission_does_not_grant_agenda_or_detailed_reports(scenario):
    api, *_ = scenario
    assert api.get("/agenda/appointments").status_code == 403
    assert api.get("/agenda/services").status_code == 403
    assert api.get("/reports/tickets.csv").status_code == 403
    assert api.get("/reports/payments.csv").status_code == 403


@pytest.mark.parametrize("requested_other", [False, True])
def test_metrics_cannot_escape_warehouse_users_branch(scenario, requested_other):
    api, db, user, home, other = scenario
    params = {"branch_id": other.id} if requested_other else {}
    overview = api.get("/dashboard/overview", params=params).json()
    assert overview["scope"]["branch_id"] == home.id
    assert overview["cards"]["clients_total"] == 1
    assert overview["cards"]["appointments_total"] == 1
    assert overview["cards"]["payments_paid_total"] == 10
    revenue = api.get("/dashboard/revenue-series", params=params).json()
    assert sum(row["paid_amount"] for row in revenue["series"]) == 10
    distribution = api.get("/dashboard/service-distribution", params=params).json()
    assert [row["service_name"] for row in distribution["rows"]] == ["Servicio Norte"]
    filters = api.get("/dashboard/filters", params=params).json()
    assert filters["branches"] == [{"id": home.id, "name": "Norte"}]
    assert [row["name"] for row in filters["services"]] == ["Servicio Norte"]


def test_unassigned_restricted_user_cannot_read_all_branches(scenario):
    api, db, user, *_ = scenario
    user.branch_id = None
    db.commit()
    for path in PATHS:
        assert api.get(path).status_code == 403
