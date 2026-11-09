from datetime import datetime

from uuid import uuid4

from fastapi import HTTPException

from app.domain.entities.tryon_style import TryOnEyeCategory, TryOnStyle, TryOnStyleVersion



AUTOMATIC = {

    "ALMOND": ("Almendrado", "shape", "Contorno alargado. La cámara estima la forma a partir de los puntos del ojo."),

    "ELONGATED": ("Rasgado / alargado", "shape", "Contorno con mayor ancho en relación con su apertura vertical. Se estima con los ojos abiertos."),
    "ROUND": ("Redondo", "shape", "Mayor apertura vertical en relación con el ancho del ojo."),

    "UPTURNED": ("Ascendente", "tilt", "La esquina exterior está más alta que la interior."),

    "DOWNTURNED": ("Descendente", "tilt", "La esquina exterior está más baja que la interior."),

}



def initialize(db):

    for key, (name, group, description) in AUTOMATIC.items():

        if db.get(TryOnEyeCategory, key) is None:

            db.add(TryOnEyeCategory(key=key, data={"name": name, "group": group, "description": description, "style_keys": []}, revision=1))

    db.flush()



def response(row, styles):

    data = dict(row.data)

    if row.key in AUTOMATIC:

        data["style_keys"] = [s.key for s in styles if s.published and s.published["is_active"] and row.key in s.published.get("eye_types", [])]

    else:
        active = {s.key for s in styles if s.published and s.published["is_active"]}
        data["style_keys"] = [key for key in data["style_keys"] if key in active]
    return {**data, "key": row.key, "revision": row.revision, "detection": "automatic" if row.key in AUTOMATIC else "manual"}



def list_categories(db):

    styles = db.query(TryOnStyle).order_by(TryOnStyle.key).all()

    return [response(row, styles) for row in db.query(TryOnEyeCategory).order_by(TryOnEyeCategory.key).all()]



def validate_styles(styles, keys):

    available = {s.key for s in styles if s.published and s.published["is_active"]}

    if not set(keys) <= available:

        raise HTTPException(422, "Selecciona estilos publicados y activos")



def create(db, payload):

    styles = db.query(TryOnStyle).order_by(TryOnStyle.key).with_for_update().all()

    if db.query(TryOnEyeCategory).count() >= 64:

        raise HTTPException(422, "Se permiten hasta 64 categorías")

    validate_styles(styles, payload.style_keys)

    row = TryOnEyeCategory(key="eye_" + uuid4().hex, data=payload.model_dump(mode="json"), revision=1)

    db.add(row)

    db.commit()

    return response(row, styles)



def save(db, key, payload):

    # Match the lock order used when publishing styles.

    styles = db.query(TryOnStyle).order_by(TryOnStyle.key).with_for_update().all()

    row = db.query(TryOnEyeCategory).filter_by(key=key).with_for_update().first()

    if row is None: raise HTTPException(404, "La categoría no existe")

    if row.revision != payload.expected_revision: raise HTTPException(409, "La categoría cambió. Actualiza antes de guardar")

    validate_styles(styles, payload.style_keys)

    if key in AUTOMATIC:

        if payload.group != AUTOMATIC[key][1]: raise HTTPException(422, "El grupo de una categoría automática está definido por el detector")

        changed = [s for s in styles if s.published and s.published["is_active"] and (key in s.published.get("eye_types", [])) != (s.key in payload.style_keys)]

        for style in changed:

            if payload.style_revisions.get(style.key) != style.revision:

                raise HTTPException(409, "Un estilo cambió. Actualiza las recomendaciones")

            if style.published is None or style.revision != style.published["revision"]:

                raise HTTPException(409, "Publica primero los cambios pendientes del estilo " + style.draft["name"])

        for style in changed:

            eyes = [e for e in style.draft.get("eye_types", []) if e != key]

            if style.key in payload.style_keys: eyes.append(key)

            style.revision += 1

            style.updated_at = datetime.utcnow()

            style.draft = {**style.draft, "eye_types": eyes}

            style.published = {**style.published, "eye_types": eyes, "revision": style.revision}

            db.add(TryOnStyleVersion(style_key=style.key, revision=style.revision, snapshot=style.published))

    row.data = payload.model_dump(mode="json", exclude={"expected_revision", "style_revisions"})

    row.revision += 1

    db.commit()

    return response(row, styles)



def delete(db, key, expected_revision):
    row = db.query(TryOnEyeCategory).filter_by(key=key).with_for_update().first()
    if row is None:
        raise HTTPException(404, "La categoría ya no existe")
    if key in AUTOMATIC:
        raise HTTPException(409, "Esta categoría pertenece al detector automático")
    if row.revision != expected_revision:
        raise HTTPException(409, "La categoría cambió. Actualiza antes de eliminar")
    db.delete(row)
    db.commit()
