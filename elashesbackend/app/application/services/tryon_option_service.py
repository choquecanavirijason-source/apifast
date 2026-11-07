import json
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from app.domain.entities.tryon_style import TryOnOption, TryOnOptionVersion, TryOnStyle
from app.presentation.schemas.tryon import OptionDraft

KINDS=("length","technique","thickness")

def validate(kind,option):
    if kind not in KINDS: raise HTTPException(404,"El catálogo no existe")
    p=option.parameters
    if kind=="length" and (p.scale is None or p.diameter is not None or p.base_technique is not None): raise HTTPException(422,"El largo necesita una escala y no admite parámetros de otras categorías")
    if kind=="thickness" and (p.diameter is None or p.scale is not None or p.base_technique is not None): raise HTTPException(422,"El grosor necesita un diámetro en mm")
    if kind=="technique" and (p.base_technique is None or p.scale is not None or p.diameter is not None): raise HTTPException(422,"La técnica necesita una distribución base")
    if kind!="technique" and (p.fibers_per_group is not None or p.spread is not None or p.density!=1 or p.single_every): raise HTTPException(422,"Los grupos de fibras corresponden a técnicas")

def initialize_options(db):
    defaults={"length":[("Corto",{"scale":.78}),("Medio",{"scale":1}),("Largo",{"scale":1.23})],"thickness":[(f"{n:.2f} mm",{"diameter":n}) for n in (.05,.07,.10,.15)],"technique":[(n,{"base_technique":i}) for i,n in enumerate(("Clásica","Volumen","Megavolumen","Híbrida"))]}
    for kind,items in defaults.items():
        for i,(name,params) in enumerate(items):
            key=f"{kind}:{i}"
            if db.get(TryOnOption,key): continue
            draft=OptionDraft(id=i,name=name,sort_order=i,parameters=params).model_dump(mode="json")
            snap={**draft,"revision":1}
            db.add(TryOnOption(key=key,kind=kind,draft=draft,revision=1,published=snap)); db.flush()
            db.add(TryOnOptionVersion(option_key=key,revision=1,snapshot=snap))
    db.commit()

def response(row): return {"option":row.draft,"revision":row.revision,"published_revision":row.published["revision"] if row.published else None,"published":row.published}
def get(db,kind,id):
    row=db.get(TryOnOption,f"{kind}:{id}")
    if row is None: raise HTTPException(404,"La opción no existe")
    return row

def list_options(db,kind):
    if kind not in KINDS: raise HTTPException(404,"El catálogo no existe")
    return [response(r) for r in sorted(db.query(TryOnOption).filter_by(kind=kind).all(),key=lambda r:(r.draft["sort_order"],r.draft["id"]))]

def create(db,kind,option):
    validate(kind,option)
    rows=db.query(TryOnOption).filter_by(kind=kind).all()
    if len(rows)>=64: raise HTTPException(422,"Máximo 64 opciones por catálogo")
    id=max((r.draft["id"] for r in rows),default=-1)+1
    draft={**option.model_dump(mode="json"),"id":id}
    row=TryOnOption(key=f"{kind}:{id}",kind=kind,draft=draft,revision=1)
    db.add(row)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(409,"Otra persona creó una opción; actualiza e intenta otra vez")
    db.refresh(row); return response(row)

def save(db,kind,id,option,expected):
    validate(kind,option)
    if option.id!=id: raise HTTPException(422,"No se puede cambiar el identificador")
    get(db,kind,id)
    result=db.execute(update(TryOnOption).where(TryOnOption.key==f"{kind}:{id}",TryOnOption.revision==expected).values(draft=option.model_dump(mode="json"),revision=expected+1))
    if result.rowcount!=1:
        db.rollback(); raise HTTPException(409,"La opción cambió; actualiza antes de guardar")
    db.commit();db.expire_all();return response(get(db,kind,id))

def published_options(db):
    return {kind:sorted([r.published for r in db.query(TryOnOption).filter_by(kind=kind).all() if r.published and r.published["is_active"]],key=lambda o:(o["sort_order"],o["id"])) for kind in KINDS}

def validate_style(db,style):
    options=published_options(db)
    for kind,field in (("length","allowed_lengths"),("technique","allowed_techniques"),("thickness","allowed_thicknesses")):
        available={o["id"] for o in options[kind]}
        if not set(getattr(style,field))<=available: raise HTTPException(422,"Publica primero las opciones seleccionadas de "+{"length":"largo","technique":"técnica","thickness":"grosor"}[kind])

def publish(db,kind,id,expected):
    # Same lock order as style publication to serialize availability checks.
    styles=db.query(TryOnStyle).order_by(TryOnStyle.key).with_for_update().all()
    rows=db.query(TryOnOption).order_by(TryOnOption.key).with_for_update().all()
    row=next((r for r in rows if r.key==f"{kind}:{id}"),None)
    if row is None: raise HTTPException(404,"La opción no existe")
    if row.revision!=expected: raise HTTPException(409,"La opción cambió; actualiza antes de publicar")
    option=OptionDraft.model_validate(row.draft); validate(kind,option)
    if not option.is_active:
        remaining={r.published["id"] for r in rows if r.kind==kind and r.key!=row.key and r.published and r.published["is_active"]}
        field={"length":"allowed_lengths","technique":"allowed_techniques","thickness":"allowed_thicknesses"}[kind]
        if not remaining or any(s.published and s.published["is_active"] and not set(s.published[field])&remaining for s in styles): raise HTTPException(422,"Asigna otra opción a los estilos que dependen de esta antes de desactivarla")
    if row.published and row.published["revision"]==row.revision: return response(row)
    row.published={**option.model_dump(mode="json"),"revision":row.revision}
    db.add(TryOnOptionVersion(option_key=row.key,revision=row.revision,snapshot=row.published));db.commit();db.refresh(row)
    return response(row)
