from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BranchTimeRange(BaseModel):
    open_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def validate_range(self):
        if self.open_time >= self.close_time:
            raise ValueError("El horario de cierre debe ser mayor al de apertura.")
        return self


class BranchDaySchedule(BaseModel):
    day: str = Field(..., min_length=2, max_length=20)
    ranges: list[BranchTimeRange] = Field(default_factory=list, max_length=2)

    @field_validator("day")
    @classmethod
    def validate_day(cls, value: str):
        normalized = value.strip().lower()
        allowed_days = {
            "lunes",
            "martes",
            "miercoles",
            "miércoles",
            "jueves",
            "viernes",
            "sabado",
            "sábado",
            "domingo",
        }
        if normalized not in allowed_days:
            raise ValueError("Dia no valido para horario de sucursal.")
        return value.strip()


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    opening_hours: list[BranchDaySchedule] = Field(default_factory=list)
    user_ids: list[int] = Field(default_factory=list)
    maps_url: Optional[str] = Field(default=None, max_length=1024)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    opening_hours: Optional[list[BranchDaySchedule]] = Field(default=None)
    user_ids: Optional[list[int]] = Field(default=None)
    qr_image_url: Optional[str] = Field(default=None, max_length=1024)
    maps_url: Optional[str] = Field(default=None, max_length=1024)


class BranchSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    country_code: Optional[str] = None
    opening_hours: list[BranchDaySchedule] = Field(default_factory=list)
    user_ids: list[int] = Field(default_factory=list)
    qr_image_url: Optional[str] = None
    maps_url: Optional[str] = None

    @field_validator("opening_hours", mode="before")
    @classmethod
    def normalize_opening_hours(cls, value):
        return value or []

    @field_validator("user_ids", mode="before")
    @classmethod
    def normalize_user_ids(cls, value):
        return value or []


class BranchResponse(BranchSummary):
    pass