"""Local UI-test server: isolated in-memory DB, dummy auth, loopback only.
Never import this test module from the production application.
"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_tryon_catalog import TryOnCatalogTests
from types import SimpleNamespace
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.presentation.controllers.tryon_controller import router
from app.core.dependencies import get_db,get_current_active_user
from sqlalchemy.orm import sessionmaker
from threading import Lock
case=TryOnCatalogTests();case.setUp()
factory=sessionmaker(bind=case.engine)
case.db.close()
app=FastAPI()
app.add_middleware(CORSMiddleware,allow_origins=["http://127.0.0.1:5179"],allow_methods=["*"],allow_headers=["*"])
app.include_router(router)
request_lock=Lock()
def database():
    # StaticPool shares one in-memory SQLite connection across HTTP workers.
    # Serialize test requests; the real backend uses a PostgreSQL pool.
    with request_lock:
        with factory() as db: yield db
app.dependency_overrides[get_db]=database
app.dependency_overrides[get_current_active_user]=lambda:SimpleNamespace(is_active=True,role=SimpleNamespace(name="Operaria",permissions=[SimpleNamespace(name="catalog:view"),SimpleNamespace(name="catalog:manage")]),direct_permissions=[])
if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="127.0.0.1",port=8679,log_level="warning")
