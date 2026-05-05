import sys
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager 
import uvicorn
import traceback

# --- SOPORTE PARA PYINSTALLER ---
def get_base_path():
    """Obtiene la ruta base, ya sea ejecutando desde Python o desde un .exe"""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.abspath(".")

# Obligamos a cargar el .env desde la ruta correcta antes de importar settings
os.environ["ENV_FILE_PATH"] = os.path.join(get_base_path(), ".env")

from app.config.settings import settings
from app.routes import auth_routes, admin
from app.database.init_db import init_db
from app.database.session import SessionLocal   
from app.database.seeders import run_seeders   

# Importaciones explícitas para evitar que PyInstaller las ignore
import app.database.migrations.add_ticket_code_to_appointments as m1
import app.database.migrations.add_payment_registered_by_notes as m2
import app.database.migrations.add_pos_sales_and_ticket_audit as m3
import app.database.migrations.add_user_created_at as m4
import app.database.migrations.add_sale_price_to_batches as m5
import app.database.migrations.add_branch_client_and_service_links as m6
import app.database.migrations.add_service_categories as m7
import app.database.migrations.add_image_url_to_services as m8
import app.database.migrations.add_image_url_to_service_categories as m9
import app.database.migrations.add_is_mobile_to_service_categories as m10
import app.database.migrations.add_is_ia_to_appointments as m11
import app.database.migrations.add_status_to_clients as m12
import app.database.migrations.add_last_activity_to_clients as m13

from app.controllers import (
    client_controller, dashboard_controller, pos_sale_controller,
    tracking_controller, catalog_controller,
    payment_controller, inventory_controller, branch_controller,
    service_agenda_controller,
)
from app.controllers.service_categories_controller import router as service_categories_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Inicializando base de datos <<<")
    init_db()  

    # Lista de migraciones ya importadas explícitamente
    migrations = [
        ("ticket_code", m1.upgrade),
        ("payment_registered_by_notes", m2.upgrade),
        ("pos_sales_and_ticket_audit", m3.upgrade),
        ("user_created_at", m4.upgrade),
        ("batch_sale_price", m5.upgrade),
        ("branch_client_service_links", m6.upgrade),
        ("service_categories_relation", m7.upgrade),
        ("services_image_url", m8.upgrade),
        ("service_categories_image_url", m9.upgrade),
        ("service_categories_is_mobile", m10.upgrade),
        ("appointments_is_ia", m11.upgrade),
        ("add_status_to_clients", m12.upgrade),
        ("add_last_activity_to_clients", m13.upgrade),
    ]

    for name, upgrade_fn in migrations:
        try:
            upgrade_fn()
        except Exception as e:
            # En producción esto suele ser porque la columna ya existe
            pass

    print(">>> Ejecutando Seeders <<<")
    db = SessionLocal()
    try:
        run_seeders(db)
        print(">>> Sistema listo para operar <<<")
    except Exception as e:
        print(f"Error al ejecutar seeders: {e}")
    finally:
        db.close()

    yield
    print(">>> Apagando sistema <<<")

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url=None, # Desactivar docs en producción (.exe)
        redoc_url=None
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        tb = traceback.format_exc()
        print(f">>> ERROR 500: {exc}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "type": type(exc).__name__},
        )

    # Configuración de CORS más flexible para Tauri
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], # En local con Tauri esto es más seguro
        allow_credentials=True, # Cambiado a True por si usas cookies de sesión
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Registro de rutas
    app.include_router(service_categories_router)
    app.include_router(service_agenda_controller.router)
    app.include_router(catalog_controller.router)
    app.include_router(tracking_controller.router)
    app.include_router(branch_controller.router)
    app.include_router(client_controller.router)
    app.include_router(dashboard_controller.router)
    app.include_router(payment_controller.router)
    app.include_router(pos_sale_controller.router)
    app.include_router(inventory_controller.router)
    app.include_router(admin.router)
    app.include_router(auth_routes.router)      
    
    return app

app = create_app()

if __name__ == "__main__":
    # Forzamos host 127.0.0.1 para evitar alertas de Firewall innecesarias
    uvicorn.run(
        app, 
        host="127.0.0.1",
        port=settings.port,
        reload=False,
        log_level="info"
    )