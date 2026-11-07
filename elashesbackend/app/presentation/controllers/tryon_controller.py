from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, require_permission
from app.presentation.schemas.tryon import StyleDraft, StyleUpdate, RevisionRequest, RestoreRequest
from app.application.services import tryon_service as service

router=APIRouter(prefix="/catalogs/tryon",tags=["Probador"])
view=Depends(require_permission("catalog:view"))
manage=Depends(require_permission("catalog:manage"))

@router.get("/manifest")
def manifest(db:Session=Depends(get_db),user=view): return service.manifest(db)

@router.get("/styles")
def styles(db:Session=Depends(get_db),user=view): return service.list_styles(db)

@router.post("/styles",status_code=201)
def create(payload:StyleDraft,db:Session=Depends(get_db),user=manage): return service.create_style(db,payload)

@router.put("/styles/{key}")
def save(key:str,payload:StyleUpdate,db:Session=Depends(get_db),user=manage): return service.save_draft(db,key,payload.style,payload.expected_revision)

@router.post("/styles/{key}/publish")
def publish(key:str,payload:RevisionRequest,db:Session=Depends(get_db),user=manage): return service.publish(db,key,payload.expected_revision)

@router.get("/styles/{key}/history")
def history(key:str,db:Session=Depends(get_db),user=view): return service.history(db,key)

@router.post("/styles/{key}/restore")
def restore(key:str,payload:RestoreRequest,db:Session=Depends(get_db),user=manage): return service.restore(db,key,payload.revision,payload.expected_revision)

@router.delete("/styles/{key}",status_code=204)
def delete(key:str,expected_revision:int=Query(ge=1),db:Session=Depends(get_db),user=manage):
    service.delete_draft(db,key,expected_revision)
    return Response(status_code=204)

from app.application.services import tryon_option_service as option_service
from app.presentation.schemas.tryon import OptionKind, OptionDraft, OptionUpdate

@router.get("/options/{kind}")
def option_list(kind:OptionKind,db:Session=Depends(get_db),user=view): return option_service.list_options(db,kind)
@router.post("/options/{kind}",status_code=201)
def option_create(kind:OptionKind,payload:OptionDraft,db:Session=Depends(get_db),user=manage): return option_service.create(db,kind,payload)
@router.put("/options/{kind}/{id}")
def option_save(kind:OptionKind,id:int,payload:OptionUpdate,db:Session=Depends(get_db),user=manage): return option_service.save(db,kind,id,payload.option,payload.expected_revision)
@router.post("/options/{kind}/{id}/publish")
def option_publish(kind:OptionKind,id:int,payload:RevisionRequest,db:Session=Depends(get_db),user=manage): return option_service.publish(db,kind,id,payload.expected_revision)
