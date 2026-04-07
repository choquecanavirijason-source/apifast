from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field

# Eye Type
class EyeTypeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class EyeTypeCreate(EyeTypeBase):
    pass


class EyeTypeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class EyeTypeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image: Optional[str] = None


class EyeTypeResponse(EyeTypeSummary):
    pass


# Effect

class EffectBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    image: Optional[str] = None


class EffectCreate(EffectBase):
    pass


class EffectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    image: Optional[str] = None


class EffectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    image: Optional[str] = None


class EffectResponse(EffectSummary):
    pass


# Volume

class VolumeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class VolumeCreate(VolumeBase):
    pass


class VolumeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    image: Optional[str] = None


class VolumeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image: Optional[str] = None


class VolumeResponse(VolumeSummary):
    pass

# Lash Design
class LashDesignBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    image: Optional[str] = None


class LashDesignCreate(LashDesignBase):
    pass


class LashDesignUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    image: Optional[str] = None


class LashDesignSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    image: Optional[str] = None


class LashDesignResponse(LashDesignSummary):
    pass


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