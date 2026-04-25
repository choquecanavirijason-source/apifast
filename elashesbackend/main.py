from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager 
import uvicorn
import traceback

from app.config.settings import settings
from app.routes import auth_routes, admin
from app.database.init_db import init_db
from app.database.session import SessionLocal  
from app.database.seeders import run_seeders   
from app.controllers import (
    client_controller, dashboard_controller, pos_sale_controller,
    tracking_controller, catalog_controller,
    payment_controller, inventory_controller, branch_controller,
    service_agenda_controller,
)
from app.controllers.service_categories_controller import router as service_categories_router

# 2. Definir el ciclo de vida (LIFESPAN)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- TODO LO QUE ESTABA EN STARTUP VA AQUÍ ---
    print(">>> Inicializando base de datos <<<")
    init_db()  

    # Migraciones
    migrations = [
        ("ticket_code", lambda: __import__("app.database.migrations.add_ticket_code_to_appointments", fromlist=["upgrade"]).upgrade()),
        ("payment_registered_by_notes", lambda: __import__("app.database.migrations.add_payment_registered_by_notes", fromlist=["upgrade"]).upgrade()),
        ("pos_sales_and_ticket_audit", lambda: __import__("app.database.migrations.add_pos_sales_and_ticket_audit", fromlist=["upgrade"]).upgrade()),
        ("user_created_at", lambda: __import__("app.database.migrations.add_user_created_at", fromlist=["upgrade"]).upgrade()),
        ("batch_sale_price", lambda: __import__("app.database.migrations.add_sale_price_to_batches", fromlist=["upgrade"]).upgrade()),
        ("branch_client_service_links", lambda: __import__("app.database.migrations.add_branch_client_and_service_links", fromlist=["upgrade"]).upgrade()),
        ("service_categories_relation", lambda: __import__("app.database.migrations.add_service_categories", fromlist=["upgrade"]).upgrade()),
            ("services_image_url", lambda: __import__("app.database.migrations.add_image_url_to_services", fromlist=["upgrade"]).upgrade()),
            ("service_categories_image_url", lambda: __import__("app.database.migrations.add_image_url_to_service_categories", fromlist=["upgrade"]).upgrade()),
            ("service_categories_is_mobile", lambda: __import__("app.database.migrations.add_is_mobile_to_service_categories", fromlist=["upgrade"]).upgrade()),
            ("appointments_is_ia", lambda: __import__("app.database.migrations.add_is_ia_to_appointments", fromlist=["upgrade"]).upgrade()),
            ("add_status_to_clients", lambda: __import__("app.database.migrations.add_status_to_clients", fromlist=["upgrade"]).upgrade()),
        ("add_last_activity_to_clients", lambda: __import__("app.database.migrations.add_last_activity_to_clients", fromlist=["upgrade"]).upgrade()),
    ]

    for name, fn in migrations:
        try:
            fn()
        except Exception as e:
            print(f"Migración {name} (puede ignorarse si ya existe): {e}")

    print(">>> Ejecutando Seeders (Poblando datos base) <<<")
    db = SessionLocal()
    try:
        run_seeders(db)
        print(">>> Sistema listo para operar <<<")
    except Exception as e:
        print(f"Error al ejecutar seeders: {e}")
    finally:
        db.close()

    yield # Aquí es donde la aplicación "corre"
    
    # --- AQUÍ PUEDES PONER CÓDIGO DE SHUTDOWN SI LO NECESITAS ---
    print(">>> Apagando sistema <<<")


def create_app() -> FastAPI:
    # 3. Pasar el lifespan a la instancia de FastAPI
    app = FastAPI(
        title=settings.app_name,
        description=settings.app_description,
        version=settings.app_version,
        lifespan=lifespan, # <--- Vincular aquí
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # ... (Resto de tu configuración de Exception Handler y Middleware se mantiene igual)
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        tb = traceback.format_exc()
        print(f">>> ERROR 500: {exc}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "type": type(exc).__name__},
        )

    # Authorization + Allow-Origin: * no es válido en navegadores. Si .env fija ALLOWED_ORIGINS solo a producción,
    # Vite (localhost:5173) queda fuera y Axios muestra ERR_NETWORK; por eso el regex de localhost va siempre.
    _cors = settings.allowed_origins or []
    _open = not _cors or _cors == ["*"]
    _list = [] if _open else list(_cors)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_list,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Categorías de servicio: /services/categories (no bajo /agenda)
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
    # Importante: Pasar el objeto app directamente, no el string
    uvicorn.run(
        app, 
        host=settings.host,
        port=settings.port,
        reload=False,  # ¡RELOAD DEBE SER FALSE EN .EXE!
        log_config=None
    )