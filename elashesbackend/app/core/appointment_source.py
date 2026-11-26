"""Origen de un ticket: reserva (va a la Agenda) o mostrador (solo Control de servicios).

  - "reserva": lo creado desde la Agenda, «Agendar reserva» del POS, la app de clientas (marketplace) o una
    venta del POS programada para más de 30 minutos después.
  - "mostrador": una venta del POS para atender ahora («Cobrar y poner en espera» / «Cobrar e iniciar atención»).

La Agenda solo dibuja reservas; Control de servicios muestra todo.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

SOURCE_RESERVA = "reserva"
SOURCE_MOSTRADOR = "mostrador"
# Misma ventana que «En espera» en Control de servicios: lo que empieza dentro de 30 min es de mostrador.
IMMEDIATE_WINDOW_MINUTES = 30
LA_PAZ_OFFSET = timedelta(hours=-4)


def naive_clock(value: datetime) -> datetime:
    """Hora sin zona horaria conservando el reloj tal cual está guardado (Postgres la trae con zona)."""
    return value.replace(tzinfo=None) if value.tzinfo is not None else value


def local_now() -> datetime:
    """Hora actual de La Paz, sin zona (así se guardan start_time/end_time de los tickets)."""
    return datetime.now(timezone.utc).replace(tzinfo=None) + LA_PAZ_OFFSET


def source_for_start(start_time: Optional[datetime], reservation_only: bool = False) -> str:
    """Origen de un ticket creado desde el POS según su hora de inicio."""
    if reservation_only or start_time is None:
        return SOURCE_RESERVA
    if naive_clock(start_time) - local_now() <= timedelta(minutes=IMMEDIATE_WINDOW_MINUTES):
        return SOURCE_MOSTRADOR
    return SOURCE_RESERVA
