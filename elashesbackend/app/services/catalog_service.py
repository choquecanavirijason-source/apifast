from typing import Optional, Type
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.tracking import (
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
    Question,
)
from app.schemas.catalog import (
    EyeTypeCreate,
    EyeTypeUpdate,
    EffectCreate,
    EffectUpdate,
    VolumeCreate,
    VolumeUpdate,
    LashDesignCreate,
    LashDesignUpdate,
    QuestionnaireCreate,
    QuestionnaireUpdate,
)


def _get_or_404(db: Session, model: Type, item_id: int, entity_name: str):
    item = db.query(model).filter(model.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} no encontrado",
        )
    return item


def _validate_unique_name(
    db: Session,
    model: Type,
    name: str,
    entity_name: str,
    exclude_id: Optional[int] = None,
):
    query = db.query(model).filter(model.name == name.strip())

    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)

    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un {entity_name.lower()} con ese nombre",
        )


def _safe_delete(db: Session, item, entity_name: str):
    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar {entity_name.lower()} porque está en uso",
        )

# Eye Types

def list_eye_types(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(EyeType)
        .order_by(EyeType.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_eye_type_by_id(db: Session, eye_type_id: int) -> EyeType:
    return _get_or_404(db, EyeType, eye_type_id, "Tipo de ojo")


def create_eye_type(db: Session, payload: EyeTypeCreate) -> EyeType:
    _validate_unique_name(db, EyeType, payload.name, "Tipo de ojo")

    item = EyeType(
        name=payload.name.strip(),
        description=payload.description,
        image=payload.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_eye_type(db: Session, eye_type_id: int, payload: EyeTypeUpdate) -> EyeType:
    item = get_eye_type_by_id(db, eye_type_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(
            db,
            EyeType,
            update_data["name"],
            "Tipo de ojo",
            exclude_id=eye_type_id,
        )
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_eye_type(db: Session, eye_type_id: int) -> None:
    item = get_eye_type_by_id(db, eye_type_id)
    _safe_delete(db, item, "Tipo de ojo")

# Effects

def list_effects(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Effect)
        .order_by(Effect.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_effect_by_id(db: Session, effect_id: int) -> Effect:
    return _get_or_404(db, Effect, effect_id, "Efecto")


def create_effect(db: Session, payload: EffectCreate) -> Effect:
    _validate_unique_name(db, Effect, payload.name, "Efecto")

    item = Effect(
        name=payload.name.strip(),
        image=payload.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_effect(db: Session, effect_id: int, payload: EffectUpdate) -> Effect:
    item = get_effect_by_id(db, effect_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(
            db,
            Effect,
            update_data["name"],
            "Efecto",
            exclude_id=effect_id,
        )
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_effect(db: Session, effect_id: int) -> None:
    item = get_effect_by_id(db, effect_id)
    _safe_delete(db, item, "Efecto")

# Volumes

def list_volumes(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Volume)
        .order_by(Volume.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_volume_by_id(db: Session, volume_id: int) -> Volume:
    return _get_or_404(db, Volume, volume_id, "Volumen")


def create_volume(db: Session, payload: VolumeCreate) -> Volume:
    _validate_unique_name(db, Volume, payload.name, "Volumen")

    item = Volume(
        name=payload.name.strip(),
        description=payload.description,
        image=payload.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_volume(db: Session, volume_id: int, payload: VolumeUpdate) -> Volume:
    item = get_volume_by_id(db, volume_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(
            db,
            Volume,
            update_data["name"],
            "Volumen",
            exclude_id=volume_id,
        )
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_volume(db: Session, volume_id: int) -> None:
    item = get_volume_by_id(db, volume_id)
    _safe_delete(db, item, "Volumen")

# Lash Designs
def list_lash_designs(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(LashDesign)
        .order_by(LashDesign.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_lash_design_by_id(db: Session, lash_design_id: int) -> LashDesign:
    return _get_or_404(db, LashDesign, lash_design_id, "Diseño de pestañas")


def create_lash_design(db: Session, payload: LashDesignCreate) -> LashDesign:
    _validate_unique_name(db, LashDesign, payload.name, "Diseño de pestañas")

    item = LashDesign(
        name=payload.name.strip(),
        image=payload.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_lash_design(
    db: Session,
    lash_design_id: int,
    payload: LashDesignUpdate,
) -> LashDesign:
    item = get_lash_design_by_id(db, lash_design_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(
            db,
            LashDesign,
            update_data["name"],
            "Diseño de pestañas",
            exclude_id=lash_design_id,
        )
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_lash_design(db: Session, lash_design_id: int) -> None:
    item = get_lash_design_by_id(db, lash_design_id)
    _safe_delete(db, item, "Diseño de pestañas")

# Questionnaires

def _questionnaire_query(db: Session):
    return db.query(Questionnaire).options(joinedload(Questionnaire.questions))


def _sort_questions(questionnaire: Questionnaire) -> Questionnaire:
    questionnaire.questions = sorted(
        questionnaire.questions,
        key=lambda q: (q.sort_order, q.id if q.id is not None else 0),
    )
    return questionnaire


def list_questionnaires(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
):
    query = _questionnaire_query(db)

    if is_active is not None:
        query = query.filter(Questionnaire.is_active == is_active)

    items = (
        query.order_by(Questionnaire.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [_sort_questions(item) for item in items]


def get_questionnaire_by_id(db: Session, questionnaire_id: int) -> Questionnaire:
    item = _questionnaire_query(db).filter(Questionnaire.id == questionnaire_id).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuestionario no encontrado",
        )

    return _sort_questions(item)


def create_questionnaire(db: Session, payload: QuestionnaireCreate) -> Questionnaire:
    questionnaire = Questionnaire(
        title=payload.title.strip(),
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(questionnaire)
    db.flush()

    for q in payload.questions:
        question = Question(
            questionnaire_id=questionnaire.id,
            text=q.text.strip(),
            question_type=q.question_type,
            is_required=q.is_required,
            sort_order=q.sort_order,
        )
        db.add(question)

    db.commit()
    db.refresh(questionnaire)
    return get_questionnaire_by_id(db, questionnaire.id)


def update_questionnaire(
    db: Session,
    questionnaire_id: int,
    payload: QuestionnaireUpdate,
) -> Questionnaire:
    questionnaire = db.query(Questionnaire).filter(
        Questionnaire.id == questionnaire_id
    ).first()

    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuestionario no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "title" in update_data and update_data["title"] is not None:
        questionnaire.title = update_data["title"].strip()

    if "description" in update_data:
        questionnaire.description = update_data["description"]

    if "is_active" in update_data:
        questionnaire.is_active = update_data["is_active"]

    if "questions" in update_data and update_data["questions"] is not None:
        db.query(Question).filter(
            Question.questionnaire_id == questionnaire_id
        ).delete(synchronize_session=False)

        for q in update_data["questions"]:
            question = Question(
                questionnaire_id=questionnaire_id,
                text=q["text"].strip(),
                question_type=q["question_type"],
                is_required=q.get("is_required", False),
                sort_order=q.get("sort_order", 0),
            )
            db.add(question)

    db.commit()
    db.refresh(questionnaire)

    return get_questionnaire_by_id(db, questionnaire_id)


def delete_questionnaire(db: Session, questionnaire_id: int) -> None:
    questionnaire = db.query(Questionnaire).filter(
        Questionnaire.id == questionnaire_id
    ).first()

    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuestionario no encontrado",
        )

    _safe_delete(db, questionnaire, "Cuestionario")