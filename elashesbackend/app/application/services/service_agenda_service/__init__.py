"""Casos de uso de la agenda de servicios (ServiceCategory + Service + Appointment).

Este paquete se dividió por responsabilidad:
- categories.py — ServiceCategory CRUD
- services.py   — Service CRUD + selección de profesionales
- appointments.py — Appointment CRUD + ticket codes + validaciones

Las funciones públicas se re-exportan aquí para mantener compat con:
    from app.application.services.service_agenda_service import create_appointment
"""
from .appointments import (
    call_next_appointment,
    create_appointment,
    delete_appointment,
    get_appointment_by_id,
    list_appointments,
    list_mobile_available_appointments,
    update_appointment,
)
from .categories import (
    create_service_category,
    delete_service_category,
    get_service_category_by_id,
    list_service_categories,
    update_service_category,
)
from .services import (
    create_service,
    delete_service,
    get_service_by_id,
    list_professionals_for_select,
    list_services,
    update_service,
)

__all__ = [
    # categories
    "create_service_category",
    "delete_service_category",
    "get_service_category_by_id",
    "list_service_categories",
    "update_service_category",
    # services
    "create_service",
    "delete_service",
    "get_service_by_id",
    "list_professionals_for_select",
    "list_services",
    "update_service",
    # appointments
    "call_next_appointment",
    "create_appointment",
    "delete_appointment",
    "get_appointment_by_id",
    "list_appointments",
    "list_mobile_available_appointments",
    "update_appointment",
]
