import json
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from app.domain.entities.tryon_style import TryOnOption, TryOnOptionVersion, TryOnStyle
from app.presentation.schemas.tryon import OptionDraft

KINDS=("length","technique","thickness","color","curl")
FIELDS={"length":"allowed_lengths","technique":"allowed_techniques","thickness":"allowed_thicknesses","color":"allowed_colors","curl":"allowed_curls"}
LABELS={"length":"largo","technique":"técnica","thickness":"grosor","color":"color","curl":"curvatura"}
# Curvaturas iniciales: las de las bandejas del salón como punto de partida
# (el salón crea las suyas). (nombre, grados, posición del doblez, nitidez).
DEFAULT_CURLS=(("Recta",0,.5,0),("Curva J",25,.6,.2),("Curva B",35,.55,.2),("Curva C",50,.5,.25),("Curva CC",62,.5,.3),("Curva D",72,.45,.3),("Curva DD",85,.45,.35),("Curva L",60,.3,.9),("Curva LC",72,.3,.7))
# Paleta inicial. El negro (0) es el aspecto aprobado de todos los estilos.
DEFAULT_COLORS=(("Negro","#111111"),("Café oscuro","#3B2416"),("Café","#6B4226"),("Azul noche","#1F2A4A"),("Borgoña","#5A1A2B"))

def validate(kind,option):
    if kind not in KINDS: raise HTTPException(404,"El catálogo no existe")
    p=option.parameters
    if kind=="length" and (p.scale is None or p.diameter is not None or p.base_technique is not None): raise HTTPException(422,"El largo necesita una escala y no admite parámetros de otras categorías")
    if kind=="thickness" and (p.diameter is None or p.scale is not None or p.base_technique is not None): raise HTTPException(422,"El grosor necesita un diámetro en mm")
    if kind=="technique" and (p.base_technique is None or p.scale is not None or p.diameter is not None): raise HTTPException(422,"La técnica necesita una distribución base")
    if kind=="color" and (p.color is None or p.scale is not None or p.diameter is not None or p.base_technique is not None): raise HTTPException(422,"El color necesita un valor hexadecimal, por ejemplo #3B2416")
    if kind!="color" and p.color is not None: raise HTTPException(422,"El color corresponde al catálogo de colores")
    curl_fields=(p.curl_deg,p.bend_position,p.bend_sharpness)
    if kind=="curl" and (any(v is None for v in curl_fields) or p.scale is not None or p.diameter is not None or p.base_technique is not None): raise HTTPException(422,"La curvatura necesita grados, posición y nitidez del doblez")
    if kind!="curl" and any(v is not None for v in curl_fields): raise HTTPException(422,"La forma del doblez corresponde al catálogo de curvaturas")
    if kind!="length" and p.map_offset_mm is not None: raise HTTPException(422,"El ajuste del mapeo corresponde a los largos")
    if kind!="technique" and (p.fibers_per_group is not None or p.spread is not None or p.density!=1 or p.single_every or p.layer_split or p.stem or p.tip_merge or p.layer_curl): raise HTTPException(422,"Los grupos de fibras corresponden a técnicas")
    if kind!="color" and p.gloss: raise HTTPException(422,"El brillo corresponde al catálogo de colores")

def initialize_options(db):
    defaults={"length":[("Corto",{"scale":.78}),("Medio",{"scale":1}),("Largo",{"scale":1.23})],"thickness":[(f"{n:.2f} mm",{"diameter":n}) for n in (.05,.07,.10,.15)],"technique":[(n,{"base_technique":i}) for i,n in enumerate(("Clásica","Volumen","Megavolumen","Híbrida"))],"color":[(n,{"color":c}) for n,c in DEFAULT_COLORS],"curl":[(n,{"curl_deg":d,"bend_position":bp,"bend_sharpness":bs}) for n,d,bp,bs in DEFAULT_CURLS]}
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
    return [response(r) for r in sorted((r for r in db.query(TryOnOption).filter_by(kind=kind).all() if not is_deleted(r)),key=lambda r:(r.draft["sort_order"],r.draft["id"]))]

def create(db,kind,option):
    validate(kind,option)
    rows=db.query(TryOnOption).filter_by(kind=kind).all()
    if len([r for r in rows if not is_deleted(r)])>=64: raise HTTPException(422,"Máximo 64 opciones por catálogo")
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

def is_deleted(row): return bool(row.draft.get("deleted"))

def remove(db,kind,id,expected):
    """Elimina una opción. Si nunca se publicó se borra del todo; si ya se publicó se da de baja (se oculta y deja de ofrecerse) y su identificador no se reutiliza, para no confundir el historial."""
    row=get(db,kind,id)
    if is_deleted(row): raise HTTPException(404,"La opción no existe")
    if row.revision!=expected: raise HTTPException(409,"La opción cambió; actualiza antes de eliminarla")
    field=FIELDS[kind]; styles=db.query(TryOnStyle).all()
    # Se quita de los estilos que la ofrecen, salvo que alguno se quede sin ninguna opción de este tipo.
    for style in styles:
        for data in (style.draft,style.published):
            if data and id in (data.get(field) or []) and not [x for x in data[field] if x!=id] and kind!="curl":
                raise HTTPException(409,f"El estilo «{(style.draft or {}).get('name',style.key)}» solo ofrece esta opción: asígnale otra antes de eliminarla")
    for style in styles:
        for attr in ("draft","published"):
            data=getattr(style,attr)
            if not data: continue
            kept=[x for x in (data.get(field) or []) if x!=id]; changes={}
            if id in (data.get(field) or []): changes[field]=kept
            defaults=data.get("defaults") or {}
            if defaults.get(kind)==id: changes["defaults"]={**defaults,kind:(kept[0] if kept else None)}
            if changes: setattr(style,attr,{**data,**changes})
    if not row.published:
        db.delete(row); db.commit(); return
    others={r.published["id"] for r in db.query(TryOnOption).filter_by(kind=kind).all() if r.key!=row.key and not is_deleted(r) and r.published and r.published["is_active"]}
    if row.published["is_active"] and not others and kind!="curl": raise HTTPException(422,"Es la única opción activa de este catálogo; crea y publica otra antes de eliminarla")
    row.draft={**row.draft,"is_active":False,"deleted":True}
    row.published={**row.published,"is_active":False}
    row.revision+=1
    db.commit()

def reorder(db,kind,ids):
    """Orden de un catálogo de opciones (arrastrar en el admin): borrador y
    publicado a la vez, sin crear versión. Hay que mandar TODAS las opciones."""
    if kind not in KINDS: raise HTTPException(404,"El catálogo no existe")
    rows={r.draft["id"]:r for r in db.query(TryOnOption).filter_by(kind=kind).all() if not is_deleted(r)}
    if len(ids)!=len(set(ids)) or set(ids)!=set(rows):
        raise HTTPException(409,"La lista de opciones cambió; actualiza e intenta otra vez")
    for order,id in enumerate(ids):
        row=rows[id]
        row.draft={**row.draft,"sort_order":order}
        if row.published: row.published={**row.published,"sort_order":order}
    db.commit()
    return list_options(db,kind)

def published_options(db):
    return {kind:sorted([r.published for r in db.query(TryOnOption).filter_by(kind=kind).all() if r.published and r.published["is_active"]],key=lambda o:(o["sort_order"],o["id"])) for kind in KINDS}

def validate_style(db,style):
    options=published_options(db)
    for kind,field in FIELDS.items():
        available={o["id"] for o in options[kind]}
        if not set(getattr(style,field))<=available: raise HTTPException(422,"Publica primero las opciones seleccionadas de "+LABELS[kind])

def enable_in_styles(styles,kind,id):
    """Agrega la opción a las opciones permitidas de cada estilo (borrador y publicado) y devuelve cuántos estilos cambiaron.
    Las curvaturas solo se agregan a los estilos que ya ofrecen alguna: con la lista vacía el estilo usa su propia curva y así se respeta."""
    field=FIELDS[kind]; changed=0
    for style in styles:
        touched=False
        for attr in ("draft","published"):
            data=getattr(style,attr)
            if not data: continue
            current=data.get(field)
            if current is None: current=[0] if kind=="color" else []
            if kind=="curl" and not current: continue
            if id in current: continue
            setattr(style,attr,{**data,field:sorted([*current,id])}); touched=True
        changed+=touched
    return changed

def enable_everywhere(db,kind,id):
    """Activa una opción ya publicada en todos los estilos."""
    styles=db.query(TryOnStyle).order_by(TryOnStyle.key).with_for_update().all()
    row=get(db,kind,id)
    if is_deleted(row) or not row.published or not row.published["is_active"]: raise HTTPException(409,"Publica la opción (y déjala disponible) antes de activarla en los estilos")
    changed=enable_in_styles(styles,kind,id)
    db.commit()
    return {"styles":changed}

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
        field=FIELDS[kind]
        # Sin curvaturas habilitadas (lista vacía) un estilo no depende de ninguna.
        empty_ok=kind=="curl"
        def depends(s):
            chosen=set(s.published.get(field,[] if empty_ok else [0]))
            return bool(chosen) and not chosen&remaining
        if (not remaining and not empty_ok) or any(s.published and s.published["is_active"] and depends(s) for s in styles): raise HTTPException(422,"Asigna otra opción a los estilos que dependen de esta antes de desactivarla")
    if row.published and row.published["revision"]==row.revision: return response(row)
    first=row.published is None
    row.published={**option.model_dump(mode="json"),"revision":row.revision}
    db.add(TryOnOptionVersion(option_key=row.key,revision=row.revision,snapshot=row.published))
    # Opción nueva y disponible: queda activa en todos los estilos, sin tener que marcarla uno por uno.
    if first and option.is_active: enable_in_styles(styles,kind,id)
    db.commit();db.refresh(row)
    return response(row)
