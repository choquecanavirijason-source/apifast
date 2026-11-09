"""Run with python -m unittest discover -s tests -p test_tryon_catalog.py.
Uses an in-memory database and does not import the production app/lifespan.
"""
import os
os.environ["DATABASE_URL"]="sqlite:///:memory:"
os.environ.pop("DB_HOST",None)
os.environ["DEBUG"]="false"
import json
import unittest
from copy import deepcopy
from types import SimpleNamespace
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import app.infrastructure.database.init_db
from app.infrastructure.database import Base
from app.domain.entities.tryon_style import TryOnStyle, TryOnStyleVersion
from app.application.services import tryon_service as service
from app.presentation.schemas.tryon import StyleDraft, RenderProfile
from app.presentation.controllers.tryon_controller import router
from app.core.dependencies import get_db, get_current_active_user

class TryOnCatalogTests(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool)
        @event.listens_for(self.engine,"connect")
        def fk(connection,record): connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(self.engine)
        self.db=sessionmaker(bind=self.engine)()
        service.initialize_defaults(self.db)
        self.defaults=json.loads(service.DEFAULTS.read_text(encoding="utf-8"))
    def tearDown(self): self.db.close(); self.engine.dispose()
    def custom(self):
        payload=deepcopy(self.defaults["styles"][0]);payload.update(key="new-fashion",name="Nuevo estilo",builtin_style=None,profile=self.defaults["templates"]["cateye"])
        return StyleDraft.model_validate(payload)
    def test_consultation_snapshot_accepts_old_recipes_and_tracks_professional_choices(self):
        from app.presentation.schemas.tryon import TryOnSelection, EyeAssessment
        style = service.get_style(self.db, "cateye").published
        recipe = {
            "style_key": "cateye", "style_name": style["name"], "revision": 1,
            "engine_version": 2, "selection": style["defaults"],
            "builtin_style": "cateye", "render_mode": "original",
        }
        self.assertIsNone(TryOnSelection.model_validate(recipe).eye_assessment)
        assessment = {"shape": "ALMOND", "shape_source": "professional", "eyelid": "hooded",
                      "depth": "deepSet", "goal": "open", "separation_ratio": .9,
                      "aspect_ratio": 3, "inclination_deg": 4, "asymmetry": .1,
                      "left_aspect_ratio": 3.1, "right_aspect_ratio": 2.9}
        saved = TryOnSelection.model_validate({**recipe, "eye_assessment": assessment}).model_dump(mode="json")
        self.assertEqual(saved["eye_assessment"], assessment)
        with self.assertRaises(ValidationError): EyeAssessment(shape="ROUND")
        with self.assertRaises(ValidationError): EyeAssessment(eyelid="invented")

    def test_eye_category_delete_checks_revision_and_protects_detector(self):
        from app.application.services import tryon_eye_service as eyes
        from app.presentation.schemas.tryon import EyeCategoryDraft
        created = eyes.create(self.db, EyeCategoryDraft(name="Temporal", style_keys=["cateye"]))
        before = deepcopy(service.get_style(self.db, "cateye").published)
        with self.assertRaises(HTTPException) as error:
            eyes.delete(self.db, created["key"], 2)
        self.assertEqual(error.exception.status_code, 409)
        self.db.rollback()
        with self.assertRaises(HTTPException): eyes.delete(self.db, "ALMOND", 1)
        self.db.rollback()
        eyes.delete(self.db, created["key"], 1)
        self.assertFalse(any(c["key"] == created["key"] for c in service.manifest(self.db)["eye_categories"]))
        self.assertEqual(service.get_style(self.db, "cateye").published, before)

    def test_manual_eye_categories_are_available_without_changing_style_geometry(self):

        from app.application.services import tryon_eye_service as eyes

        from app.presentation.schemas.tryon import EyeCategoryDraft, EyeCategoryUpdate

        before = deepcopy(service.get_style(self.db, "cateye").published)

        created = eyes.create(self.db, EyeCategoryDraft(name="Encapotado", group="lid", style_keys=["cateye"]))

        self.assertEqual(created["detection"], "manual")

        self.assertEqual(service.get_style(self.db, "cateye").published, before)

        catalog = service.manifest(self.db)

        self.assertTrue(any(c["key"] == created["key"] for c in catalog["eye_categories"]))

        eyes.save(self.db, created["key"], EyeCategoryUpdate(name="Encapotado suave", group="lid", expected_revision=1, style_keys=["wispy"]))

        with self.assertRaises(HTTPException) as error:

            eyes.save(self.db, created["key"], EyeCategoryUpdate(name="Obsoleto", expected_revision=1))

        self.assertEqual(error.exception.status_code, 409)

        self.db.rollback()

        with self.assertRaises(HTTPException): eyes.create(self.db, EyeCategoryDraft(name="Inválido", style_keys=["missing"]))

    def test_automatic_eye_assignments_publish_atomically_and_preserve_pending_drafts(self):

        from app.application.services import tryon_eye_service as eyes

        from app.presentation.schemas.tryon import EyeCategoryUpdate

        rows = service.list_styles(self.db)

        revisions = {r["style"]["key"]:r["revision"] for r in rows}

        original = deepcopy(service.get_style(self.db, "cateye").published)

        eyes.save(self.db, "ALMOND", EyeCategoryUpdate(name="Almendrado", group="shape", style_keys=["cateye"], expected_revision=1, style_revisions=revisions))

        current = service.get_style(self.db, "cateye")

        self.assertEqual(current.published["eye_types"], ["ALMOND"])

        self.assertEqual(current.published["profile"], original["profile"])

        payload = deepcopy(current.draft); payload["description"] = "Pendiente"

        service.save_draft(self.db, "cateye", StyleDraft.model_validate(payload), current.revision)

        with self.assertRaises(HTTPException) as error:

            eyes.save(self.db, "ALMOND", EyeCategoryUpdate(name="Almendrado", group="shape", expected_revision=2, style_revisions={"cateye": current.revision}))

        self.assertEqual(error.exception.status_code, 409)

        self.db.rollback()

        self.assertEqual(service.get_style(self.db, "cateye").published["eye_types"], ["ALMOND"])

    def test_options_are_versioned_and_need_publication_before_assignment(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft
        before=service.manifest(self.db)
        created=opts.create(self.db,"length",OptionDraft(name="Extra largo",parameters={"scale":1.4}))
        id=created["option"]["id"]
        self.assertEqual(id,3)
        self.assertEqual(service.manifest(self.db)["revision"],before["revision"])
        style=self.custom().model_dump();style["allowed_lengths"]=[id];style["defaults"]["length"]=id
        row=service.create_style(self.db,StyleDraft.model_validate(style))
        with self.assertRaises(HTTPException): service.publish(self.db,"new-fashion",1)
        self.db.rollback()
        opts.publish(self.db,"length",id,1)
        service.publish(self.db,"new-fashion",1)
        self.assertEqual(next(s for s in service.manifest(self.db)["styles"] if s["key"]=="new-fashion")["defaults"]["length"],id)
        edited=deepcopy(created["option"]);edited["parameters"]["scale"]=1.6
        opts.save(self.db,"length",id,OptionDraft.model_validate(edited),1)
        self.assertEqual(next(o for o in service.manifest(self.db)["options"]["length"] if o["id"]==id)["parameters"]["scale"],1.4)
        with self.assertRaises(HTTPException) as error: opts.save(self.db,"length",id,OptionDraft.model_validate(edited),1)
        self.assertEqual(error.exception.status_code,409)
        opts.publish(self.db,"length",id,2)
        self.assertEqual(next(o for o in service.manifest(self.db)["options"]["length"] if o["id"]==id)["parameters"]["scale"],1.6)

    def test_option_deactivation_cannot_break_a_published_style(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft
        payload=deepcopy(service.get_style(self.db,"cateye").draft)
        payload["allowed_lengths"]=[1]
        service.save_draft(self.db,"cateye",StyleDraft.model_validate(payload),1);service.publish(self.db,"cateye",2)
        option=deepcopy(opts.get(self.db,"length",1).draft);option["is_active"]=False
        opts.save(self.db,"length",1,OptionDraft.model_validate(option),1)
        with self.assertRaises(HTTPException) as error:opts.publish(self.db,"length",1,2)
        self.assertEqual(error.exception.status_code,422);self.db.rollback()
        payload["allowed_lengths"]=[0,1];service.save_draft(self.db,"cateye",StyleDraft.model_validate(payload),2);service.publish(self.db,"cateye",3)
        opts.publish(self.db,"length",1,2)
        visible=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="cateye")
        self.assertEqual(visible["allowed_lengths"],[0]);self.assertEqual(visible["defaults"]["length"],0)

    def test_numeric_option_limits_and_categories(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft
        for parameters in ({"scale":float("nan")},{"diameter":1},{"base_technique":9},{"base_technique":1,"fibers_per_group":9}):
            with self.assertRaises(ValidationError):OptionDraft(name="Inválida",parameters=parameters)
        with self.assertRaises(HTTPException):opts.create(self.db,"length",OptionDraft(name="Categoría incorrecta",parameters={"diameter":.07}))
        edited=deepcopy(opts.get(self.db,"technique",0).draft);edited["name"]="Clásica del salón"
        opts.save(self.db,"technique",0,OptionDraft.model_validate(edited),1)
        opts.initialize_options(self.db)
        self.assertEqual(opts.get(self.db,"technique",0).draft["name"],"Clásica del salón")

    def test_lash_map_is_optional_validated_and_published_to_the_app(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft
        payload=self.custom().model_dump(mode="json")
        for bad in ([9,10],[3,10,11],[9,10,21],[9,10.5,11]):
            with self.assertRaises(ValidationError):StyleDraft.model_validate({**payload,"lash_map":bad})
        style=StyleDraft.model_validate({**payload,"lash_map":[8,9,10,9,11,12]})
        service.create_style(self.db,style);service.publish(self.db,"new-fashion",1)
        published=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="new-fashion")
        self.assertEqual(published["lash_map"],[8,9,10,9,11,12])
        self.assertEqual(published["map_profile"],self.defaults["templates"]["cateye"]["length_profile"])
        builtin=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="anime")
        self.assertIsNone(builtin["profile"]);self.assertEqual(builtin["map_profile"],self.defaults["templates"]["anime"]["length_profile"])
        self.assertIsNone(StyleDraft.model_validate(payload).lash_map)
        opts.create(self.db,"length",OptionDraft(name="Extra largo",parameters={"scale":1.4,"map_offset_mm":4}))
        with self.assertRaises(HTTPException):opts.create(self.db,"thickness",OptionDraft(name="Grosor raro",parameters={"diameter":.07,"map_offset_mm":1}))

    def test_reorder_changes_order_without_new_versions(self):
        from app.application.services import tryon_option_service as opts
        keys=[r["style"]["key"] for r in service.list_styles(self.db)]
        before={r.key:(r.revision,r.published["revision"]) for r in self.db.query(TryOnStyle).all()}
        wanted=list(reversed(keys))
        self.assertEqual([r["style"]["key"] for r in service.reorder_styles(self.db,wanted)],wanted)
        self.assertEqual([s["key"] for s in service.manifest(self.db)["styles"]],wanted)
        self.assertEqual({r.key:(r.revision,r.published["revision"]) for r in self.db.query(TryOnStyle).all()},before)
        with self.assertRaises(HTTPException):service.reorder_styles(self.db,wanted[1:])
        ids=[r["option"]["id"] for r in opts.list_options(self.db,"length")]
        opts.reorder(self.db,"length",list(reversed(ids)))
        self.assertEqual([o["id"] for o in service.manifest(self.db)["options"]["length"]],list(reversed(ids)))
        with self.assertRaises(HTTPException):opts.reorder(self.db,"length",ids+[99])

    def test_dynamic_recipe_snapshot_preserves_values_and_validates_ids(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft,TryOnSelection
        options={}
        for kind,name,p in (("length","Extra largo",{"scale":1.4}),("technique","Volumen 5D",{"base_technique":1,"fibers_per_group":5,"spread":12}),("thickness","0.12 mm",{"diameter":.12})):
            r=opts.create(self.db,kind,OptionDraft(name=name,parameters=p));opts.publish(self.db,kind,r["option"]["id"],1)
            options[kind]=opts.get(self.db,kind,r["option"]["id"]).published
        saved=TryOnSelection(style_key="cateye",style_name="Cat Eye",revision=1,engine_version=2,builtin_style="cateye",render_mode="procedural",selection={k:v["id"] for k,v in options.items()},resolved_options=options)
        snapshot=saved.model_dump(mode="json")
        edited=deepcopy(options["thickness"]);edited.pop("revision");edited["parameters"]["diameter"]=.14
        opts.save(self.db,"thickness",edited["id"],OptionDraft.model_validate(edited),1);opts.publish(self.db,"thickness",edited["id"],2)
        self.assertEqual(snapshot["resolved_options"]["thickness"]["parameters"]["diameter"],.12)
        snapshot["selection"]["thickness"]=0
        with self.assertRaises(ValidationError):TryOnSelection.model_validate(snapshot)

    def test_lash_colors_default_to_black_and_are_assigned_per_style(self):
        from app.application.services import tryon_option_service as opts
        from app.presentation.schemas.tryon import OptionDraft,TryOnSelection
        manifest=service.manifest(self.db)
        palette=manifest["options"]["color"]
        self.assertEqual([o["name"] for o in palette],["Negro","Café oscuro","Café","Azul noche","Borgoña"])
        self.assertEqual(palette[0]["parameters"]["color"],"#111111")
        # Los estilos aprobados no cambian: solo negro hasta que el salón asigne otro.
        for style in manifest["styles"]:
            self.assertEqual(style["allowed_colors"],[0]);self.assertEqual(style["defaults"]["color"],0)
        # Un estilo publicado antes del catálogo de colores (sin los campos) se lee en negro.
        row=service.get_style(self.db,"cateye");legacy=deepcopy(row.published);legacy.pop("allowed_colors",None);legacy["defaults"].pop("color",None)
        row.published=legacy;self.db.commit()
        visible=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="cateye")
        self.assertEqual((visible["allowed_colors"],visible["defaults"]["color"]),([0],0))
        # Valores inválidos y categorías cruzadas.
        for value in ("negro","#12345","#GGGGGG","111111"):
            with self.assertRaises(ValidationError):OptionDraft(name="Inválido",parameters={"color":value})
        with self.assertRaises(HTTPException):opts.create(self.db,"color",OptionDraft(name="Sin color",parameters={}))
        with self.assertRaises(HTTPException):opts.create(self.db,"length",OptionDraft(name="Largo con color",parameters={"scale":1,"color":"#111111"}))
        # Un color nuevo necesita publicarse antes de asignarlo, y llega al manifiesto.
        created=opts.create(self.db,"color",OptionDraft(name="Verde bosque",parameters={"color":"#1E3A2B"}));id=created["option"]["id"]
        style=self.custom().model_dump();style["allowed_colors"]=[0,id];style["defaults"]["color"]=id
        service.create_style(self.db,StyleDraft.model_validate(style))
        with self.assertRaises(HTTPException):service.publish(self.db,"new-fashion",1)
        self.db.rollback();opts.publish(self.db,"color",id,1);service.publish(self.db,"new-fashion",1)
        published=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="new-fashion")
        self.assertEqual((published["allowed_colors"],published["defaults"]["color"]),([0,id],id))
        bad=deepcopy(style);bad["defaults"]["color"]=4
        with self.assertRaises(ValidationError):StyleDraft.model_validate(bad)
        # La receta de la clienta guarda el color elegido; las recetas viejas siguen siendo válidas.
        resolved={k:opts.get(self.db,k,i).published for k,i in (("length",1),("technique",0),("thickness",3),("color",id))}
        saved=TryOnSelection(style_key="new-fashion",style_name="Nuevo estilo",revision=1,engine_version=2,profile=style["profile"],render_mode="procedural",selection={"length":1,"technique":0,"thickness":3,"color":id},resolved_options=resolved).model_dump(mode="json")
        self.assertEqual(saved["resolved_options"]["color"]["parameters"]["color"],"#1E3A2B")
        saved["selection"]["color"]=0
        with self.assertRaises(ValidationError):TryOnSelection.model_validate(saved)
        old=TryOnSelection(style_key="cateye",style_name="Cat Eye",revision=1,builtin_style="cateye",render_mode="original",selection={"length":1,"technique":0,"thickness":3})
        self.assertEqual(old.selection.color,0);self.assertIsNone(old.resolved_options)

    def test_defaults_are_exact_originals_and_bootstrap_is_idempotent(self):
        service.initialize_defaults(self.db)
        manifest=service.manifest(self.db)
        self.assertEqual(len(manifest["styles"]),11)
        self.assertEqual(self.db.query(TryOnStyleVersion).count(),11)
        for style in manifest["styles"]:
            self.assertIsNone(style["profile"])
            self.assertEqual(style["key"],style["builtin_style"])
    def test_new_shape_is_not_visible_until_published(self):
        row=service.create_style(self.db,self.custom())
        self.assertEqual(len(service.manifest(self.db)["styles"]),11)
        service.publish(self.db,"new-fashion",row["revision"])
        visible=service.manifest(self.db)["styles"]
        self.assertEqual(len(visible),12)
        self.assertIsNotNone(next(s for s in visible if s["key"]=="new-fashion")["profile"])
    def test_draft_revision_conflict_and_immutable_published_history(self):
        before=service.manifest(self.db)["revision"]
        row=service.get_style(self.db,"cateye")
        payload=deepcopy(row.draft);payload["name"]="Cat Eye VIP"
        service.save_draft(self.db,"cateye",StyleDraft.model_validate(payload),1)
        self.assertEqual(service.manifest(self.db)["revision"],before)
        with self.assertRaises(HTTPException) as error: service.save_draft(self.db,"cateye",StyleDraft.model_validate(payload),1)
        self.assertEqual(error.exception.status_code,409)
        service.publish(self.db,"cateye",2)
        old=service.history(self.db,"cateye")[-1]
        self.assertEqual(old["style"]["name"],"Cat Eye")
        restored=service.restore(self.db,"cateye",1,2)
        self.assertEqual(restored["revision"],3)
        self.assertEqual(service.get_style(self.db,"cateye").published["name"],"Cat Eye VIP")
    def test_inactive_styles_are_published_as_tombstones(self):
        payload=deepcopy(service.get_style(self.db,"cateye").draft);payload["is_active"]=False
        service.save_draft(self.db,"cateye",StyleDraft.model_validate(payload),1)
        service.publish(self.db,"cateye",2)
        style=next(s for s in service.manifest(self.db)["styles"] if s["key"]=="cateye")
        self.assertFalse(style["is_active"])
    def test_last_active_style_cannot_be_disabled(self):
        for item in list(service.manifest(self.db)["styles"]):
            key=item["key"];payload=deepcopy(service.get_style(self.db,key).draft);payload["is_active"]=False
            service.save_draft(self.db,key,StyleDraft.model_validate(payload),1)
            if key=="kimk":
                with self.assertRaises(HTTPException) as error: service.publish(self.db,key,2)
                self.assertEqual(error.exception.status_code,422)
            else: service.publish(self.db,key,2)
    def test_geometry_validation_rejects_heavy_and_inverted_profiles(self):
        for mutate in [lambda p:p.update(roots=[72,48,41,56]),lambda p:p["length_profile"].reverse(),lambda p:p.update(curl=float("nan")),lambda p:p.update(spike_every=2,spike_offset=3)]:
            profile=deepcopy(self.defaults["templates"]["cateye"]);mutate(profile)
            with self.assertRaises(ValidationError): RenderProfile.model_validate(profile)
    def test_custom_style_requires_profile_and_available_default(self):
        payload=self.custom().model_dump();payload["profile"]=None
        with self.assertRaises(ValidationError): StyleDraft.model_validate(payload)
        payload=self.custom().model_dump();payload["allowed_lengths"]=[0]
        with self.assertRaises(ValidationError): StyleDraft.model_validate(payload)
    def test_migration_upgrades_legacy_tracking_and_is_idempotent(self):
        from unittest.mock import patch
        from sqlalchemy import inspect,text
        from app.infrastructure.database.migrations import add_tryon_catalog as migration
        engine=create_engine("sqlite:///:memory:")
        with engine.begin() as conn: conn.execute(text("CREATE TABLE client_tracking(id INTEGER PRIMARY KEY)"))
        with patch.object(migration,"engine",engine),patch.object(migration,"SessionLocal",sessionmaker(bind=engine)):
            migration.upgrade();migration.upgrade()
        self.assertIn("tryon_recipe",{c["name"] for c in inspect(engine).get_columns("client_tracking")})
        with sessionmaker(bind=engine)() as db:self.assertEqual(db.query(TryOnStyle).count(),11)
        engine.dispose()

    def test_client_selection_keeps_exact_profile_after_catalog_edit(self):
        from app.domain.entities.client import Client
        from app.presentation.schemas.tracking import TrackingCreate,TrackingUpdate
        from app.application.services.tracking_service import create_tracking,update_tracking
        client=Client(name="Clienta",last_name="Prueba")
        self.db.add(client);self.db.commit()
        style=self.custom()
        service.create_style(self.db,style);service.publish(self.db,style.key,1)
        snapshot={"style_key":style.key,"style_name":style.name,"revision":1,"engine_version":1,"builtin_style":None,"profile":style.profile.model_dump(mode="json"),"render_mode":"procedural","selection":{"length":2,"technique":3,"thickness":1}}
        record=create_tracking(self.db,TrackingCreate(client_id=client.id,tryon_recipe=snapshot))
        self.assertEqual(record.tryon_recipe["selection"]["thickness"],1)
        changed=style.model_dump(mode="json");changed["profile"]["curl"]=.9
        service.save_draft(self.db,style.key,StyleDraft.model_validate(changed),1);service.publish(self.db,style.key,2)
        self.db.expire_all()
        self.assertEqual(record.tryon_recipe["profile"]["curl"],snapshot["profile"]["curl"])
        newer=deepcopy(snapshot);newer["selection"]["length"]=0
        updated=update_tracking(self.db,record.id,TrackingUpdate(tryon_recipe=newer))
        self.assertEqual(updated.tryon_recipe["selection"]["length"],0)

    def test_http_contract_and_authorization(self):
        app=FastAPI();app.include_router(router)
        def database(): yield self.db
        role=SimpleNamespace(name="Operaria",permissions=[SimpleNamespace(name="catalog:view")])
        user=SimpleNamespace(role=role,is_active=True,direct_permissions=[])
        app.dependency_overrides[get_db]=database
        app.dependency_overrides[get_current_active_user]=lambda:user
        with TestClient(app) as client:
            self.assertEqual(client.get("/catalogs/tryon/manifest").status_code,200)
            self.assertEqual(client.post("/catalogs/tryon/styles",json=self.custom().model_dump()).status_code,403)
            self.assertEqual(client.get("/catalogs/tryon/options/length").status_code,200)
            option={"name":"Largo API","parameters":{"scale":1.3}}
            self.assertEqual(client.post("/catalogs/tryon/options/length",json=option).status_code,403)
            self.assertEqual(client.put("/catalogs/tryon/options/length/1",json={"expected_revision":1,"option":{"id":1,**option}}).status_code,403)
            self.assertEqual(client.post("/catalogs/tryon/options/length/1/publish",json={"expected_revision":1}).status_code,403)
            role.permissions.append(SimpleNamespace(name="catalog:manage"))
            response=client.post("/catalogs/tryon/options/length",json=option)
            self.assertEqual(response.status_code,201,response.text)
            option_id=response.json()["option"]["id"]
            self.assertEqual(client.post(f"/catalogs/tryon/options/length/{option_id}/publish",json={"expected_revision":1}).status_code,200)
            created=client.post("/catalogs/tryon/styles",json=self.custom().model_dump())
            self.assertEqual(created.status_code,201,created.text)
            published=client.post("/catalogs/tryon/styles/new-fashion/publish",json={"expected_revision":1})
            self.assertEqual(published.status_code,200,published.text)
            self.assertEqual(client.delete("/catalogs/tryon/styles/new-fashion?expected_revision=1").status_code,409)

if __name__=="__main__": unittest.main()
