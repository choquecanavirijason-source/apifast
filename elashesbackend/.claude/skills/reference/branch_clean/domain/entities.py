"""
Entidad de dominio: independiente de SQLAlchemy, de FastAPI y de Pydantic.
Es un dataclass simple. Las reglas de negocio puras (validaciones, invariantes)
viven aquí como métodos sin I/O.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TimeRange:
    open_time: str   # "HH:MM"
    close_time: str  # "HH:MM"

    def __post_init__(self) -> None:
        if self.open_time >= self.close_time:
            raise ValueError("close_time debe ser mayor a open_time")


@dataclass
class DaySchedule:
    day: str
    ranges: list[TimeRange] = field(default_factory=list)

    ALLOWED_DAYS = {
        "lunes", "martes", "miercoles", "miércoles",
        "jueves", "viernes", "sabado", "sábado", "domingo",
    }

    def __post_init__(self) -> None:
        if self.day.strip().lower() not in self.ALLOWED_DAYS:
            raise ValueError(f"Día no válido: {self.day}")
        if not 1 <= len(self.ranges) <= 2:
            raise ValueError("Cada día debe tener 1 o 2 rangos horarios")


@dataclass
class Branch:
    """Entidad raíz del agregado Branch."""
    id: Optional[int]
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    opening_hours: list[DaySchedule] = field(default_factory=list)
    user_ids: list[int] = field(default_factory=list)

    def rename(self, new_name: str) -> None:
        """Regla de dominio: el nombre no puede ser vacío ni > 100 chars."""
        new_name = new_name.strip()
        if not new_name or len(new_name) > 100:
            raise ValueError("Nombre inválido para la sucursal")
        self.name = new_name
