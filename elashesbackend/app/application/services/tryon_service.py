import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session
from app.domain.entities.tryon_style import TryOnStyle, TryOnStyleVersion
from app.presentation.schemas.tryon import StyleDraft
from app.application.services import tryon_option_service as options

DEFAULTS = Path(__file__).resolve().parents[2] / "core" / "tryon_defaults.json"
def initialize_defaults(db: Session):
    """Idempotent: never overwrite edits or intentionally inactive styles."""
    options.initialize_options(db)
    for entry in json.loads(DEFAULTS.read_text(encoding="utf-8"))["styles"]:
        if db.get(TryOnStyle, entry["key"]) is not None: continue
        draft = StyleDraft.model_validate(entry).model_dump(mode="json")
        snapshot = {**draft, "revision": 1, "engine_version": 1}
        db.add(TryOnStyle(key=entry["key"], draft=draft, revision=1, published=snapshot))
        db.add(TryOnStyleVersion(style_key=entry["key"], revision=1, snapshot=snapshot))
        db.flush()
    db.commit()

def get_style(db, key):
    row = db.get(TryOnStyle, key)
    if row is None: raise HTTPException(404, "El estilo no existe")
    return row

def as_response(row):
    return {"style": row.draft, "revision": row.revision, "published_revision": row.published.get("revision") if row.published else None, "updated_at": row.updated_at.replace(tzinfo=timezone.utc).isoformat()}

def list_styles(db):
    rows = db.query(TryOnStyle).all()
    return [as_response(r) for r in sorted(rows, key=lambda r: (r.draft["sort_order"],r.key))]

def create_style(db, style):
    if db.query(TryOnStyle).count() >= 500: raise HTTPException(422,"El catálogo admite hasta 500 estilos")
    if db.get(TryOnStyle, style.key): raise HTTPException(409, "Ya existe ese identificador; duplica el diseño con otro identificador")
    row = TryOnStyle(key=style.key, draft=style.model_dump(mode="json"), revision=1)
    db.add(row); db.commit(); db.refresh(row)
    return as_response(row)

def save_draft(db, key, style, expected_revision):
    if style.key != key: raise HTTPException(422, "El identificador de un estilo no se puede cambiar")
    get_style(db,key)
    result = db.execute(update(TryOnStyle).where(TryOnStyle.key==key,TryOnStyle.revision==expected_revision).values(draft=style.model_dump(mode="json"),revision=expected_revision+1,updated_at=datetime.utcnow()))
    if result.rowcount != 1:
        db.rollback(); raise HTTPException(409, "Otra persona cambió este estilo. Actualiza antes de guardar")
    db.commit(); db.expire_all()
    return as_response(get_style(db,key))

def publish(db,key,expected_revision):
    # Serialize publication decisions, including the last-active-style check.
    rows = db.query(TryOnStyle).order_by(TryOnStyle.key).with_for_update().all()
    row = next((r for r in rows if r.key==key),None)
    if row is None: raise HTTPException(404,"El estilo no existe")
    if row.revision != expected_revision: raise HTTPException(409,"El borrador cambió; actualiza antes de publicar")
    style = StyleDraft.model_validate(row.draft)
    if style.is_active: options.validate_style(db,style)
    if not style.is_active and not any(r.key != key and r.published and r.published["is_active"] for r in rows):
        raise HTTPException(422,"Debe quedar al menos un estilo publicado activo")
    if row.published and row.published["revision"]==row.revision: return as_response(row)
    snapshot = {**style.model_dump(mode="json"),"revision":row.revision,"engine_version":2}
    row.published = snapshot
    db.add(TryOnStyleVersion(style_key=key,revision=row.revision,snapshot=snapshot))
    db.commit(); db.refresh(row)
    return as_response(row)

def history(db,key):
    get_style(db,key)
    return [{"revision":r.revision,"published_at":r.published_at.replace(tzinfo=timezone.utc).isoformat(),"style":r.snapshot} for r in db.query(TryOnStyleVersion).filter_by(style_key=key).order_by(TryOnStyleVersion.revision.desc()).all()]

def restore(db,key,revision,expected_revision):
    version=db.query(TryOnStyleVersion).filter_by(style_key=key,revision=revision).first()
    if version is None: raise HTTPException(404,"No existe esa versión publicada")
    payload={k:v for k,v in version.snapshot.items() if k not in ("revision","engine_version")}
    return save_draft(db,key,StyleDraft.model_validate(payload),expected_revision)

def delete_draft(db,key,expected_revision):
    row=get_style(db,key)
    if row.revision != expected_revision: raise HTTPException(409,"El borrador cambió")
    if row.published: raise HTTPException(409,"Desactiva y publica el estilo para conservar el historial de las clientas")
    db.delete(row); db.commit()

def manifest(db):
    styles=[r.published for r in db.query(TryOnStyle).all() if r.published]
    styles.sort(key=lambda s:(s["sort_order"],s["key"]))
    catalog_options=options.published_options(db)
    # Disabled options are removed from choices, retaining a valid initial choice.
    styles=json.loads(json.dumps(styles))
    for style in styles:
        for kind,field in (("length","allowed_lengths"),("technique","allowed_techniques"),("thickness","allowed_thicknesses")):
            ids={o["id"] for o in catalog_options[kind]}
            style[field]=[i for i in style[field] if i in ids]
            if not style[field] and not style["is_active"]: style[field]=[catalog_options[kind][0]["id"]]
            if style["defaults"][kind] not in style[field]: style["defaults"][kind]=style[field][0] if style[field] else 0
    signature=hashlib.sha256(json.dumps({"styles":styles,"options":catalog_options},sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return {"schema_version":2,"engine_version":2,"revision":signature,"styles":styles,"options":catalog_options}
