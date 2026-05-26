"""
DTOs Pydantic v2. Idénticos a `app/schemas/branch.py` — los duplicamos aquí
solo para que la carpeta de referencia sea autocontenida. En un refactor real
se usarían los del repo directamente.
"""
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BranchTimeRange(BaseModel):
    open_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def validate_range(self):
        if self.open_time >= self.close_time:
            raise ValueError("close_time debe ser mayor a open_time")
        return self


class BranchDaySchedule(BaseModel):
    day: str = Field(..., min_length=2, max_length=20)
    ranges: list[BranchTimeRange] = Field(default_factory=list, min_length=1, max_length=2)

    @field_validator("day")
    @classmethod
    def validate_day(cls, value: str):
        allowed = {
            "lunes", "martes", "miercoles", "miércoles",
            "jueves", "viernes", "sabado", "sábado", "domingo",
        }
        if value.strip().lower() not in allowed:
            raise ValueError("Día no válido para horario de sucursal.")
        return value.strip()


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    opening_hours: list[BranchDaySchedule] = Field(default_factory=list)
    user_ids: list[int] = Field(default_factory=list)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    opening_hours: Optional[list[BranchDaySchedule]] = Field(default=None)
    user_ids: Optional[list[int]] = Field(default=None)


class BranchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    opening_hours: list[BranchDaySchedule] = Field(default_factory=list)
    user_ids: list[int] = Field(default_factory=list)

    @field_validator("opening_hours", mode="before")
    @classmethod
    def _norm_hours(cls, v):
        return v or []

    @field_validator("user_ids", mode="before")
    @classmethod
    def _norm_users(cls, v):
        return v or []
