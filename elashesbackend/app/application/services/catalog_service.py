from typing import Optional, Type
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.tracking import (
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Design,
    Questionnaire,
    Question,
)
from app.domain.entities.lash_design_final import Tecnologia, DisenoFinal, DisenoGuardado
from app.domain.entities.client import Client
from app.presentation.schemas.catalog import (
    EyeTypeCreate,
    EyeTypeUpdate,
    EffectCreate,
    EffectUpdate,
    VolumeCreate,
    VolumeUpdate,
    LashDesignCreate,
    LashDesignUpdate,
    DesignCreate,
    DesignUpdate,
    QuestionnaireCreate,
    QuestionnaireUpdate,
    TecnologiaCreate,
    TecnologiaUpdate,
    DisenoFinalCreate,
    DisenoFinalUpdate,
    DisenoGuardadoCreate,
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
    field: str = "name",
):
    column = getattr(model, field)
    query = db.query(model).filter(column == name.strip())

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

# Designs (combinaciones sugeridas con imagen y modelo 3D)

def list_designs(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Design)
        .order_by(Design.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_design_by_id(db: Session, design_id: int) -> Design:
    return _get_or_404(db, Design, design_id, "Diseño")


def create_design(db: Session, payload: DesignCreate) -> Design:
    _validate_unique_name(db, Design, payload.name, "Diseño")

    item = Design(
        name=payload.name.strip(),
        effect=payload.effect,
        eye_type=payload.eye_type,
        lash_design=payload.lash_design,
        note=payload.note,
        image=payload.image,
        model_3d_url=payload.model_3d_url,
        model_3d_filename=payload.model_3d_filename,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_design(db: Session, design_id: int, payload: DesignUpdate) -> Design:
    item = get_design_by_id(db, design_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(db, Design, update_data["name"], "Diseño", exclude_id=design_id)
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_design(db: Session, design_id: int) -> None:
    item = get_design_by_id(db, design_id)
    _safe_delete(db, item, "Diseño")

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

# Tecnologías

def list_tecnologias(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Tecnologia)
        .order_by(Tecnologia.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tecnologia_by_id(db: Session, tecnologia_id: int) -> Tecnologia:
    return _get_or_404(db, Tecnologia, tecnologia_id, "Tecnología")


def create_tecnologia(db: Session, payload: TecnologiaCreate) -> Tecnologia:
    _validate_unique_name(db, Tecnologia, payload.name, "Tecnología")

    item = Tecnologia(
        name=payload.name.strip(),
        description=payload.description,
        image=payload.image,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_tecnologia(db: Session, tecnologia_id: int, payload: TecnologiaUpdate) -> Tecnologia:
    item = get_tecnologia_by_id(db, tecnologia_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        _validate_unique_name(
            db,
            Tecnologia,
            update_data["name"],
            "Tecnología",
            exclude_id=tecnologia_id,
        )
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_tecnologia(db: Session, tecnologia_id: int) -> None:
    item = get_tecnologia_by_id(db, tecnologia_id)
    _safe_delete(db, item, "Tecnología")

# Diseños Finales (Tecnología + Efecto + Tipo de ojo + Volumen)

def _diseno_final_query(db: Session):
    return db.query(DisenoFinal).options(
        joinedload(DisenoFinal.tecnologia),
        joinedload(DisenoFinal.efecto),
        joinedload(DisenoFinal.tipo_ojo),
        joinedload(DisenoFinal.volumen),
    )


def list_disenos_finales(db: Session, skip: int = 0, limit: int = 100):
    return (
        _diseno_final_query(db)
        .order_by(DisenoFinal.nombre_unico.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_diseno_final_by_id(db: Session, diseno_final_id: int) -> DisenoFinal:
    item = _diseno_final_query(db).filter(DisenoFinal.id == diseno_final_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diseño final no encontrado")
    return item


def _validate_diseno_final_refs(
    db: Session, tecnologia_id: int, efecto_id: int, tipo_ojo_id: int, volumen_id: int
) -> None:
    if not db.query(Tecnologia).filter(Tecnologia.id == tecnologia_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tecnología no existe")
    if not db.query(Effect).filter(Effect.id == efecto_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Efecto no existe")
    if not db.query(EyeType).filter(EyeType.id == tipo_ojo_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de ojo no existe")
    if not db.query(Volume).filter(Volume.id == volumen_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Volumen no existe")


def create_diseno_final(db: Session, payload: DisenoFinalCreate) -> DisenoFinal:
    _validate_unique_name(
        db, DisenoFinal, payload.nombre_unico, "Diseño final", field="nombre_unico"
    )
    _validate_diseno_final_refs(
        db, payload.tecnologia_id, payload.efecto_id, payload.tipo_ojo_id, payload.volumen_id
    )

    item = DisenoFinal(
        nombre_unico=payload.nombre_unico.strip(),
        tecnologia_id=payload.tecnologia_id,
        efecto_id=payload.efecto_id,
        tipo_ojo_id=payload.tipo_ojo_id,
        volumen_id=payload.volumen_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return get_diseno_final_by_id(db, item.id)


def update_diseno_final(db: Session, diseno_final_id: int, payload: DisenoFinalUpdate) -> DisenoFinal:
    item = get_diseno_final_by_id(db, diseno_final_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "nombre_unico" in update_data and update_data["nombre_unico"] is not None:
        _validate_unique_name(
            db,
            DisenoFinal,
            update_data["nombre_unico"],
            "Diseño final",
            exclude_id=diseno_final_id,
            field="nombre_unico",
        )
        update_data["nombre_unico"] = update_data["nombre_unico"].strip()

    _validate_diseno_final_refs(
        db,
        update_data.get("tecnologia_id", item.tecnologia_id),
        update_data.get("efecto_id", item.efecto_id),
        update_data.get("tipo_ojo_id", item.tipo_ojo_id),
        update_data.get("volumen_id", item.volumen_id),
    )

    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return get_diseno_final_by_id(db, diseno_final_id)


def delete_diseno_final(db: Session, diseno_final_id: int) -> None:
    item = get_diseno_final_by_id(db, diseno_final_id)
    _safe_delete(db, item, "Diseño final")

# Diseños Guardados (Diseño Final guardado para una clienta)

def _diseno_guardado_query(db: Session):
    return db.query(DisenoGuardado).options(
        joinedload(DisenoGuardado.client),
        joinedload(DisenoGuardado.diseno_final).joinedload(DisenoFinal.tecnologia),
        joinedload(DisenoGuardado.diseno_final).joinedload(DisenoFinal.efecto),
        joinedload(DisenoGuardado.diseno_final).joinedload(DisenoFinal.tipo_ojo),
        joinedload(DisenoGuardado.diseno_final).joinedload(DisenoFinal.volumen),
    )


def list_disenos_guardados(db: Session, client_id: Optional[int] = None):
    query = _diseno_guardado_query(db)
    if client_id is not None:
        query = query.filter(DisenoGuardado.client_id == client_id)
    return query.order_by(DisenoGuardado.fecha_guardado.desc()).all()


def create_diseno_guardado(db: Session, payload: DisenoGuardadoCreate) -> DisenoGuardado:
    if not db.query(Client).filter(Client.id == payload.client_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clienta no encontrada")
    get_diseno_final_by_id(db, payload.diseno_final_id)  # 404 si no existe

    existing = (
        db.query(DisenoGuardado)
        .filter(
            DisenoGuardado.client_id == payload.client_id,
            DisenoGuardado.diseno_final_id == payload.diseno_final_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este diseño ya está guardado para esta clienta",
        )

    item = DisenoGuardado(client_id=payload.client_id, diseno_final_id=payload.diseno_final_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return (
        _diseno_guardado_query(db).filter(DisenoGuardado.id == item.id).first()
    )


def delete_diseno_guardado(db: Session, diseno_guardado_id: int) -> None:
    item = db.query(DisenoGuardado).filter(DisenoGuardado.id == diseno_guardado_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diseño guardado no encontrado")
    db.delete(item)
    db.commit()