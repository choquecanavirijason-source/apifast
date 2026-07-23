from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field

# Eye Type
class EyeTypeBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EyeTypeCreate(EyeTypeBase):
    pass


class EyeTypeUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EyeTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EyeTypeResponse(EyeTypeSummary):
    pass


# Effect

class EffectBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2, max_length=255)
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EffectCreate(EffectBase):
    pass


class EffectUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EffectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class EffectResponse(EffectSummary):
    pass


# Volume

class VolumeBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class VolumeCreate(VolumeBase):
    pass


class VolumeUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class VolumeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class VolumeResponse(VolumeSummary):
    pass

# Lash Design
class LashDesignBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2, max_length=255)
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class LashDesignCreate(LashDesignBase):
    pass


class LashDesignUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class LashDesignSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class LashDesignResponse(LashDesignSummary):
    pass


# Design (combinaciones sugeridas con imagen y modelo 3D)
class DesignBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str = Field(..., min_length=2, max_length=255)
    effect: Optional[str] = None
    eye_type: Optional[str] = None
    lash_design: Optional[str] = None
    volume: Optional[str] = None
    note: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class DesignCreate(DesignBase):
    pass


class DesignUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    effect: Optional[str] = None
    eye_type: Optional[str] = None
    lash_design: Optional[str] = None
    volume: Optional[str] = None
    note: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


class DesignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    name: str
    effect: Optional[str] = None
    eye_type: Optional[str] = None
    lash_design: Optional[str] = None
    volume: Optional[str] = None
    note: Optional[str] = None
    image: Optional[str] = None
    model_3d_url: Optional[str] = None
    model_3d_filename: Optional[str] = None


# Questionnaire / Question
QuestionType = Literal["text", "number", "bool", "select", "multi_select"]


class QuestionBase(BaseModel):
    text: str = Field(..., min_length=2)
    question_type: QuestionType
    is_required: bool = False
    sort_order: int = 0


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    text: Optional[str] = Field(default=None, min_length=2)
    question_type: Optional[QuestionType] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    questionnaire_id: int
    text: str
    question_type: QuestionType
    is_required: bool
    sort_order: int


class QuestionnaireBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    is_active: bool = True


class QuestionnaireCreate(QuestionnaireBase):
    questions: List[QuestionCreate] = []


class QuestionnaireUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    questions: Optional[List[QuestionCreate]] = None


class QuestionnaireSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    is_active: bool


class QuestionnaireResponse(QuestionnaireSummary):
    questions: List[QuestionResponse] = []


# Tecnología
class TecnologiaBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class TecnologiaCreate(TecnologiaBase):
    pass


class TecnologiaUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class TecnologiaSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image: Optional[str] = None


class TecnologiaResponse(TecnologiaSummary):
    pass


# Diseño Final (combinación Tecnología + Efecto + Tipo de ojo + Volumen)
class DisenoFinalBase(BaseModel):
    nombre_unico: str = Field(..., min_length=2, max_length=255)
    tecnologia_id: int
    efecto_id: int
    tipo_ojo_id: int
    volumen_id: int


class DisenoFinalCreate(DisenoFinalBase):
    pass


class DisenoFinalUpdate(BaseModel):
    nombre_unico: Optional[str] = Field(default=None, min_length=2, max_length=255)
    tecnologia_id: Optional[int] = None
    efecto_id: Optional[int] = None
    tipo_ojo_id: Optional[int] = None
    volumen_id: Optional[int] = None


class DisenoFinalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_unico: str
    tecnologia_id: int
    efecto_id: int
    tipo_ojo_id: int
    volumen_id: int
    created_at: datetime
    tecnologia: TecnologiaSummary
    efecto: EffectSummary
    tipo_ojo: EyeTypeSummary
    volumen: VolumeSummary


# Diseño Guardado (un Diseño Final guardado para una clienta)
class DisenoGuardadoCreate(BaseModel):
    client_id: int
    diseno_final_id: int


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str


class DisenoGuardadoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    diseno_final_id: int
    fecha_guardado: datetime
    client: ClientSummary
    diseno_final: DisenoFinalResponse