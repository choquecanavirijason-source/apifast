from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from test_tryon_catalog import TryOnCatalogTests
from app.application.services import tryon_service as service, tryon_option_service as opts
from app.presentation.schemas.tryon import OptionDraft, StyleDraft
from pathlib import Path
import json, sys
case=TryOnCatalogTests();case.setUp()
try:
    ids={}
    for kind,name,params in (("length","Extra largo",{"scale":1.4}),("technique","Volumen 5D",{"base_technique":1,"fibers_per_group":5,"single_every":0,"density":1.2,"spread":12}),("thickness","0.12 mm",{"diameter":.12})):
        row=opts.create(case.db,kind,OptionDraft(name=name,parameters=params));id=row["option"]["id"];opts.publish(case.db,kind,id,1);ids[kind]=id
    style=case.custom().model_dump();style["key"]="custom-5d"
    for kind,field in (("length","allowed_lengths"),("technique","allowed_techniques"),("thickness","allowed_thicknesses")):
        style[field]=[ids[kind]];style["defaults"][kind]=ids[kind]
    service.create_style(case.db,StyleDraft.model_validate(style));service.publish(case.db,style["key"],1)
    Path(sys.argv[1]).write_text(json.dumps(service.manifest(case.db),ensure_ascii=False,indent=2),encoding="utf-8")
finally:case.tearDown()
