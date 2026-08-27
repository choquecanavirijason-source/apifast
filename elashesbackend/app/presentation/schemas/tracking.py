from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field

from app.presentation.schemas.client import ClientSummary
from app.presentation.schemas.user import UserSummary
from app.presentation.schemas.catalog import (
    EyeTypeSummary,
    EffectSummary,
    VolumeSummary,
    LashDesignSummary,
    QuestionnaireSummary,
)


class TrackingBase(BaseModel):
    client_id: int
    appointment_id: Optional[int] = None
    branch_id: Optional[int] = None
    professional_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    effect_id: Optional[int] = None
    volume_id: Optional[int] = None
    lash_design_id: Optional[int] = None
    questionnaire_id: Optional[int] = None
    design_notes: Optional[str] = Field(default=None, max_length=255)
    last_application_date: Optional[datetime] = None
    questionnaire_responses: Optional[Dict[str, Any]] = None


class TrackingCreate(TrackingBase):
    pass


class TrackingUpdate(BaseModel):
    appointment_id: Optional[int] = None
    branch_id: Optional[int] = None
    professional_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    effect_id: Optional[int] = None
    volume_id: Optional[int] = None
    lash_design_id: Optional[int] = None
    questionnaire_id: Optional[int] = None
    design_notes: Optional[str] = Field(default=None, max_length=255)
    last_application_date: Optional[datetime] = None
    questionnaire_responses: Optional[Dict[str, Any]] = None


class LashAiReviewResponse(BaseModel):
    feedback: str
    model: str


class LashAiRecommendationResponse(BaseModel):
    reason: str
    eye_shape: Optional[str] = None
    recommended_design: Optional[str] = None
    recommended_effect: Optional[str] = None
    recommended_volume: Optional[str] = None
    model: str


class TrackingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    appointment_id: Optional[int] = None
    branch_id: Optional[int] = None
    professional_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    effect_id: Optional[int] = None
    volume_id: Optional[int] = None
    lash_design_id: Optional[int] = None
    questionnaire_id: Optional[int] = None
    design_notes: Optional[str] = None
    last_application_date: datetime
    questionnaire_responses: Optional[Dict[str, Any]] = None
    # Calculadas por el backend a partir del efecto/volumen/diseño aplicado.
    next_maintenance_date: Optional[datetime] = None
    next_removal_date: Optional[datetime] = None

    client: ClientSummary
    professional: Optional[UserSummary] = None
    eye_type: Optional[EyeTypeSummary] = None
    effect: Optional[EffectSummary] = None
    volume: Optional[VolumeSummary] = None
    lash_design: Optional[LashDesignSummary] = None
    questionnaire: Optional[QuestionnaireSummary] = None