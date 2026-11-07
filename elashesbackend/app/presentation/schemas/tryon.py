from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

BUILTINS = ("cateye", "wispy", "catclassic", "foxyeye", "natural", "dolleye", "squirrel", "kitten", "wetlook", "anime", "kimk")
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class LengthPoint(StrictModel):
    t: float = Field(ge=0, le=1)
    length: float = Field(ge=.08, le=1.2)

class RenderProfile(StrictModel):
    length_profile: list[LengthPoint] = Field(min_length=2, max_length=33)
    curl: float = Field(ge=0, le=1.2)
    fan: float = Field(ge=0, le=35)
    sweep: float = Field(ge=-40, le=40)
    roots: list[int] = Field(min_length=4, max_length=4)
    spike_every: int = Field(default=0, ge=0, le=16)
    spike_offset: int = Field(default=0, ge=0, le=15)
    spike_multiplier: float = Field(default=1, ge=.5, le=2.5)
    fan_spread: float = Field(default=10, ge=0, le=24)
    mega_fan_spread: float = Field(default=16, ge=0, le=24)
    width_multiplier: float = Field(default=1, ge=.4, le=1.8)

    @model_validator(mode="after")
    def geometry_limits(self):
        points = self.length_profile
        if points[0].t != 0 or points[-1].t != 1 or any(a.t >= b.t for a, b in zip(points, points[1:])):
            raise ValueError("El perfil debe cubrir del lagrimal (0) al extremo (1) con puntos ordenados")
        for technique, count in enumerate(self.roots):
            fibers = count if technique == 0 else count * 3 if technique == 1 else count * 6 if technique == 2 else (count // 2) * 4 + (count % 2)
            if count < 8 or count > 120 or fibers > 240:
                raise ValueError("Máximo 240 fibras por ojo; reduce los grupos de la técnica")
        if self.spike_every and self.spike_offset >= self.spike_every:
            raise ValueError("La posición del pico debe ser menor que su frecuencia")
        return self

class SelectionDefaults(StrictModel):
    length: int = Field(default=1, ge=0, le=4095)
    technique: int = Field(default=0, ge=0, le=4095)
    thickness: int = Field(default=3, ge=0, le=4095)

class StyleDraft(StrictModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1500)
    thumbnail: str | None = Field(default=None, max_length=600000)
    builtin_style: str | None = None
    profile: RenderProfile | None = None
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=10000)
    allowed_lengths: list[int] = Field(default_factory=lambda: [0,1,2], min_length=1, max_length=64)
    allowed_techniques: list[int] = Field(default_factory=lambda: [0,1,2,3], min_length=1, max_length=64)
    allowed_thicknesses: list[int] = Field(default_factory=lambda: [0,1,2,3], min_length=1, max_length=64)
    defaults: SelectionDefaults = Field(default_factory=SelectionDefaults)
    eye_types: list[Literal["ALMOND", "ROUND", "UPTURNED", "DOWNTURNED"]] = Field(default_factory=list, max_length=4)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if len(value) < 2: raise ValueError("Escribe un nombre de al menos dos caracteres")
        return value

    @field_validator("thumbnail")
    @classmethod
    def image_source(cls, value):
        if value and not value.startswith(("https://", "http://", "/media/", "data:image/png;base64,")):
            raise ValueError("Usa una imagen PNG o una URL de imagen válida")
        return value

    @model_validator(mode="after")
    def validate_recipe(self):
        if self.builtin_style is not None and self.builtin_style not in BUILTINS:
            raise ValueError("La base original no existe")
        if self.profile is None and self.builtin_style is None:
            raise ValueError("Un estilo nuevo necesita un perfil de diseño")
        for allowed, maximum, chosen in [(self.allowed_lengths,4095,self.defaults.length),(self.allowed_techniques,4095,self.defaults.technique),(self.allowed_thicknesses,4095,self.defaults.thickness)]:
            if len(set(allowed)) != len(allowed) or any(type(i) is not int or i < 0 or i > maximum for i in allowed) or chosen not in allowed:
                raise ValueError("Las opciones deben ser únicas y contener la selección predeterminada")
        if len(set(self.eye_types)) != len(self.eye_types): raise ValueError("Tipo de ojo repetido")
        return self

class StyleUpdate(StrictModel):
    expected_revision: int = Field(ge=1)
    style: StyleDraft

class RevisionRequest(StrictModel):
    expected_revision: int = Field(ge=1)

class RestoreRequest(RevisionRequest):
    revision: int = Field(ge=1)

class TryOnSelection(StrictModel):
    style_key: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,63}$")
    style_name: str = Field(min_length=2, max_length=120)
    revision: int = Field(ge=0)
    engine_version: Literal[1, 2] = 1
    selection: SelectionDefaults
    builtin_style: str | None = None
    profile: RenderProfile | None = None
    render_mode: Literal["original", "procedural"]
    resolved_options: "ResolvedOptions | None" = None

    @model_validator(mode="after")
    def known_geometry(self):
        if self.builtin_style not in BUILTINS and self.profile is None:
            raise ValueError("El diseño guardado necesita una base o perfil válido")
        if self.resolved_options:
            for kind in ("length","technique","thickness"):
                if getattr(self.resolved_options,kind).id!=getattr(self.selection,kind): raise ValueError("La selección no coincide con sus parámetros guardados")
        elif self.selection.length>2 or self.selection.technique>3 or self.selection.thickness>3:
            raise ValueError("Las opciones nuevas necesitan una copia de sus parámetros")
        return self

OptionKind = Literal["length", "technique", "thickness"]
class OptionParameters(StrictModel):
    scale: float | None = Field(default=None, ge=.4, le=1.8)
    diameter: float | None = Field(default=None, ge=.03, le=.25)
    base_technique: int | None = Field(default=None, ge=0, le=3)
    fibers_per_group: int | None = Field(default=None, ge=1, le=8)
    single_every: int = Field(default=0, ge=0, le=8)
    density: float = Field(default=1, ge=.25, le=1.5)
    spread: float | None = Field(default=None, ge=0, le=24)

class OptionDraft(StrictModel):
    id: int = Field(default=0, ge=0, le=4095)
    name: str = Field(min_length=2, max_length=80)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0, le=10000)
    parameters: OptionParameters
    @field_validator("name")
    @classmethod
    def trim_name(cls,v):
        v=v.strip()
        if len(v)<2: raise ValueError("Escribe un nombre de al menos dos caracteres")
        return v
class OptionUpdate(StrictModel):
    expected_revision: int = Field(ge=1)
    option: OptionDraft

class PublishedOption(OptionDraft):
    revision: int = Field(ge=1)
class ResolvedOptions(StrictModel):
    length: PublishedOption
    technique: PublishedOption
    thickness: PublishedOption
    @model_validator(mode="after")
    def correct_categories(self):
        if self.length.parameters.scale is None or self.thickness.parameters.diameter is None or self.technique.parameters.base_technique is None:
            raise ValueError("Faltan los parámetros de la combinación")
        return self
TryOnSelection.model_rebuild()
