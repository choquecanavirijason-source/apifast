from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.media import save_catalog_image, save_design_model
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.catalog import (
    EyeTypeCreate,
    EyeTypeUpdate,
    EyeTypeResponse,
    EffectCreate,
    EffectUpdate,
    EffectResponse,
    VolumeCreate,
    VolumeUpdate,
    VolumeResponse,
    LashDesignCreate,
    LashDesignUpdate,
    LashDesignResponse,
    DesignCreate,
    DesignUpdate,
    DesignResponse,
    QuestionnaireCreate,
    QuestionnaireUpdate,
    QuestionnaireResponse,
    TecnologiaCreate,
    TecnologiaUpdate,
    TecnologiaResponse,
    DisenoFinalCreate,
    DisenoFinalUpdate,
    DisenoFinalResponse,
    DisenoGuardadoCreate,
    DisenoGuardadoResponse,
)
from app.application.services.catalog_service import (
    list_eye_types,
    get_eye_type_by_id,
    create_eye_type,
    update_eye_type,
    delete_eye_type,
    list_effects,
    get_effect_by_id,
    create_effect,
    update_effect,
    delete_effect,
    list_volumes,
    get_volume_by_id,
    create_volume,
    update_volume,
    delete_volume,
    list_lash_designs,
    get_lash_design_by_id,
    create_lash_design,
    update_lash_design,
    delete_lash_design,
    list_designs,
    get_design_by_id,
    create_design,
    update_design,
    delete_design,
    list_questionnaires,
    get_questionnaire_by_id,
    create_questionnaire,
    update_questionnaire,
    delete_questionnaire,
    list_tecnologias,
    get_tecnologia_by_id,
    create_tecnologia,
    update_tecnologia,
    delete_tecnologia,
    list_disenos_finales,
    get_diseno_final_by_id,
    create_diseno_final,
    update_diseno_final,
    delete_diseno_final,
    list_disenos_guardados,
    create_diseno_guardado,
    delete_diseno_guardado,
)


router = APIRouter(
    prefix="/catalogs",
    tags=["Catalogos"],
)


# Subida de imágenes de catálogo (devuelve la ruta pública `/media/...`).
# El cliente luego envía esa ruta en el campo `image` al crear/actualizar el ítem.
@router.post("/upload-image", status_code=status.HTTP_201_CREATED)
def upload_catalog_image(
    folder: str = Query(
        default="lash-designs",
        description="Carpeta destino: lash-designs, eye-types, effects, volumes, misc",
    ),
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    image_path = save_catalog_image(file=file, folder=folder)
    return {"image": image_path}


# Eye Types
@router.get("/eye-types", response_model=List[EyeTypeResponse])
def get_eye_types(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_eye_types(db=db, skip=skip, limit=limit)


@router.get("/eye-types/{eye_type_id}", response_model=EyeTypeResponse)
def get_eye_type(
    eye_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_eye_type_by_id(db=db, eye_type_id=eye_type_id)


@router.post(
    "/eye-types",
    response_model=EyeTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_eye_type(
    payload: EyeTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_eye_type(db=db, payload=payload)


@router.put("/eye-types/{eye_type_id}", response_model=EyeTypeResponse)
def update_existing_eye_type(
    eye_type_id: int,
    payload: EyeTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_eye_type(db=db, eye_type_id=eye_type_id, payload=payload)


@router.delete("/eye-types/{eye_type_id}", response_model=MessageResponse)
def delete_existing_eye_type(
    eye_type_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_eye_type(db=db, eye_type_id=eye_type_id)
    return MessageResponse(message="Tipo de ojo eliminado correctamente")

# Effects
@router.get("/effects", response_model=List[EffectResponse])
def get_effects(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_effects(db=db, skip=skip, limit=limit)


@router.get("/effects/{effect_id}", response_model=EffectResponse)
def get_effect(
    effect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_effect_by_id(db=db, effect_id=effect_id)


@router.post(
    "/effects",
    response_model=EffectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_effect(
    payload: EffectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_effect(db=db, payload=payload)


@router.put("/effects/{effect_id}", response_model=EffectResponse)
def update_existing_effect(
    effect_id: int,
    payload: EffectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_effect(db=db, effect_id=effect_id, payload=payload)


@router.delete("/effects/{effect_id}", response_model=MessageResponse)
def delete_existing_effect(
    effect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_effect(db=db, effect_id=effect_id)
    return MessageResponse(message="Efecto eliminado correctamente")

# Volumes

@router.get("/volumes", response_model=List[VolumeResponse])
def get_volumes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_volumes(db=db, skip=skip, limit=limit)


@router.get("/volumes/{volume_id}", response_model=VolumeResponse)
def get_volume(
    volume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_volume_by_id(db=db, volume_id=volume_id)


@router.post(
    "/volumes",
    response_model=VolumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_volume(
    payload: VolumeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_volume(db=db, payload=payload)


@router.put("/volumes/{volume_id}", response_model=VolumeResponse)
def update_existing_volume(
    volume_id: int,
    payload: VolumeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_volume(db=db, volume_id=volume_id, payload=payload)


@router.delete("/volumes/{volume_id}", response_model=MessageResponse)
def delete_existing_volume(
    volume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_volume(db=db, volume_id=volume_id)
    return MessageResponse(message="Volumen eliminado correctamente")

# Lash Designs
@router.get("/lash-designs", response_model=List[LashDesignResponse])
def get_lash_designs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_lash_designs(db=db, skip=skip, limit=limit)


@router.get("/lash-designs/{lash_design_id}", response_model=LashDesignResponse)
def get_lash_design(
    lash_design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_lash_design_by_id(db=db, lash_design_id=lash_design_id)


@router.post(
    "/lash-designs",
    response_model=LashDesignResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_lash_design(
    payload: LashDesignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_lash_design(db=db, payload=payload)


@router.put("/lash-designs/{lash_design_id}", response_model=LashDesignResponse)
def update_existing_lash_design(
    lash_design_id: int,
    payload: LashDesignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_lash_design(
        db=db,
        lash_design_id=lash_design_id,
        payload=payload,
    )


@router.delete("/lash-designs/{lash_design_id}", response_model=MessageResponse)
def delete_existing_lash_design(
    lash_design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_lash_design(db=db, lash_design_id=lash_design_id)
    return MessageResponse(message="Diseño de pestañas eliminado correctamente")


# Designs (combinaciones sugeridas con imagen y modelo 3D)

# Subida del modelo 3D (glb/gltf/obj/fbx/stl). Devuelve la ruta pública
# `/media/design-models/...` que el cliente envía luego en `model_3d_url`.
@router.post("/designs/upload-model", status_code=status.HTTP_201_CREATED)
def upload_design_model(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    model_url = save_design_model(file=file)
    return {"model_3d_url": model_url, "model_3d_filename": file.filename}


@router.get("/designs", response_model=List[DesignResponse])
def get_designs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_designs(db=db, skip=skip, limit=limit)


@router.get("/designs/{design_id}", response_model=DesignResponse)
def get_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_design_by_id(db=db, design_id=design_id)


@router.post(
    "/designs",
    response_model=DesignResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_design(
    payload: DesignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_design(db=db, payload=payload)


@router.put("/designs/{design_id}", response_model=DesignResponse)
def update_existing_design(
    design_id: int,
    payload: DesignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_design(db=db, design_id=design_id, payload=payload)


@router.delete("/designs/{design_id}", response_model=MessageResponse)
def delete_existing_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_design(db=db, design_id=design_id)
    return MessageResponse(message="Diseño eliminado correctamente")


# Questionnaires
@router.get("/questionnaires", response_model=List[QuestionnaireResponse])
def get_questionnaires(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forms:view")),
):
    return list_questionnaires(
        db=db,
        skip=skip,
        limit=limit,
        is_active=is_active,
    )


@router.get("/questionnaires/{questionnaire_id}", response_model=QuestionnaireResponse)
def get_questionnaire(
    questionnaire_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forms:view")),
):
    return get_questionnaire_by_id(db=db, questionnaire_id=questionnaire_id)


@router.post(
    "/questionnaires",
    response_model=QuestionnaireResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_questionnaire(
    payload: QuestionnaireCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forms:manage")),
):
    return create_questionnaire(db=db, payload=payload)


@router.put(
    "/questionnaires/{questionnaire_id}",
    response_model=QuestionnaireResponse,
)
def update_existing_questionnaire(
    questionnaire_id: int,
    payload: QuestionnaireUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forms:manage")),
):
    return update_questionnaire(
        db=db,
        questionnaire_id=questionnaire_id,
        payload=payload,
    )


@router.delete("/questionnaires/{questionnaire_id}", response_model=MessageResponse)
def delete_existing_questionnaire(
    questionnaire_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forms:manage")),
):
    delete_questionnaire(db=db, questionnaire_id=questionnaire_id)
    return MessageResponse(message="Cuestionario eliminado correctamente")


# Tecnologías
@router.get("/tecnologias", response_model=List[TecnologiaResponse])
def get_tecnologias(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_tecnologias(db=db, skip=skip, limit=limit)


@router.get("/tecnologias/{tecnologia_id}", response_model=TecnologiaResponse)
def get_tecnologia(
    tecnologia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_tecnologia_by_id(db=db, tecnologia_id=tecnologia_id)


@router.post(
    "/tecnologias",
    response_model=TecnologiaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_tecnologia(
    payload: TecnologiaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_tecnologia(db=db, payload=payload)


@router.put("/tecnologias/{tecnologia_id}", response_model=TecnologiaResponse)
def update_existing_tecnologia(
    tecnologia_id: int,
    payload: TecnologiaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_tecnologia(db=db, tecnologia_id=tecnologia_id, payload=payload)


@router.delete("/tecnologias/{tecnologia_id}", response_model=MessageResponse)
def delete_existing_tecnologia(
    tecnologia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_tecnologia(db=db, tecnologia_id=tecnologia_id)
    return MessageResponse(message="Tecnología eliminada correctamente")


# Diseños Finales (Tecnología + Efecto + Tipo de ojo + Volumen)
@router.get("/disenos-finales", response_model=List[DisenoFinalResponse])
def get_disenos_finales(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_disenos_finales(db=db, skip=skip, limit=limit)


@router.get("/disenos-finales/{diseno_final_id}", response_model=DisenoFinalResponse)
def get_diseno_final(
    diseno_final_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return get_diseno_final_by_id(db=db, diseno_final_id=diseno_final_id)


@router.post(
    "/disenos-finales",
    response_model=DisenoFinalResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_diseno_final(
    payload: DisenoFinalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_diseno_final(db=db, payload=payload)


@router.put("/disenos-finales/{diseno_final_id}", response_model=DisenoFinalResponse)
def update_existing_diseno_final(
    diseno_final_id: int,
    payload: DisenoFinalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return update_diseno_final(db=db, diseno_final_id=diseno_final_id, payload=payload)


@router.delete("/disenos-finales/{diseno_final_id}", response_model=MessageResponse)
def delete_existing_diseno_final(
    diseno_final_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_diseno_final(db=db, diseno_final_id=diseno_final_id)
    return MessageResponse(message="Diseño final eliminado correctamente")


# Diseños Guardados (Diseño Final guardado para una clienta)
@router.get("/disenos-guardados", response_model=List[DisenoGuardadoResponse])
def get_disenos_guardados(
    client_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:view")),
):
    return list_disenos_guardados(db=db, client_id=client_id)


@router.post(
    "/disenos-guardados",
    response_model=DisenoGuardadoResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_diseno_guardado(
    payload: DisenoGuardadoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    return create_diseno_guardado(db=db, payload=payload)


@router.delete("/disenos-guardados/{diseno_guardado_id}", response_model=MessageResponse)
def delete_existing_diseno_guardado(
    diseno_guardado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("catalog:manage")),
):
    delete_diseno_guardado(db=db, diseno_guardado_id=diseno_guardado_id)
    return MessageResponse(message="Diseño guardado eliminado correctamente")