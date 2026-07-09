import sys
import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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
from app.presentation.routes import auth_routes, admin
from app.infrastructure.database.init_db import init_db
from app.infrastructure.database.session import SessionLocal   
from app.infrastructure.database.seeders import run_seeders
from app.infrastructure.database.seed_operarias import seed_operarias   

# Importaciones explícitas para evitar que PyInstaller las ignore
import app.infrastructure.database.migrations.add_ticket_code_to_appointments as m1
import app.infrastructure.database.migrations.add_payment_registered_by_notes as m2
import app.infrastructure.database.migrations.add_pos_sales_and_ticket_audit as m3
import app.infrastructure.database.migrations.add_user_created_at as m4
import app.infrastructure.database.migrations.add_sale_price_to_batches as m5
import app.infrastructure.database.migrations.add_branch_client_and_service_links as m6
import app.infrastructure.database.migrations.add_service_categories as m7
import app.infrastructure.database.migrations.add_image_url_to_services as m8
import app.infrastructure.database.migrations.add_image_url_to_service_categories as m9
import app.infrastructure.database.migrations.add_is_mobile_to_service_categories as m10
import app.infrastructure.database.migrations.add_is_ia_to_appointments as m11
import app.infrastructure.database.migrations.add_status_to_clients as m12
import app.infrastructure.database.migrations.add_last_activity_to_clients as m13
import app.infrastructure.database.migrations.add_branch_opening_hours as m14
import app.infrastructure.database.migrations.add_branch_integration_profiles as m15
import app.infrastructure.database.migrations.add_admin_ai_settings as m16
import app.infrastructure.database.migrations.add_ai_permissions as m17
import app.infrastructure.database.migrations.add_skill_level_to_users as m18
import app.infrastructure.database.migrations.add_min_stock_to_products as m19
import app.infrastructure.database.migrations.add_email_to_clients as m20
import app.infrastructure.database.migrations.add_advance_payment_to_appointments as m21
import app.infrastructure.database.migrations.add_commission_rate_to_users as m22
import app.infrastructure.database.migrations.add_temp_branch_to_users as m23
import app.infrastructure.database.migrations.add_cash_close_tables as m24
import app.infrastructure.database.migrations.add_commission_rate_to_services as m25
import app.infrastructure.database.migrations.add_qr_image_url_to_branches as m26
import app.infrastructure.database.migrations.add_commission_payments_table as m27
import app.infrastructure.database.migrations.add_marketplace_products_table as m28
import app.infrastructure.database.migrations.add_ci_marketplace_to_clients as m29
import app.infrastructure.database.migrations.add_maps_url_to_branches as m30

from app.presentation.controllers import (
    client_controller, dashboard_controller, pos_sale_controller, admin_ai_controller,
    tracking_controller, catalog_controller,
    payment_controller, inventory_controller, branch_controller,
    service_agenda_controller, reports_controller,
)
from app.presentation.controllers.notifications_controller import router as notifications_router
from app.presentation.controllers.service_categories_controller import router as service_categories_router
from app.presentation.controllers.commission_payment_controller import router as commission_payments_router
from app.presentation.controllers.marketplace_controller import router as marketplace_router
from app.presentation.controllers.marketplace_proxy_controller import router as marketplace_proxy_router
from app.presentation.controllers.marketplace_booking_controller import router as marketplace_booking_router
from app.core.ws_manager import ws_manager
from app.infrastructure.security.jwt import decode_token, JWTError

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Inicializando base de datos <<<")
    init_db()  

    # Migraciones ejecutadas en orden. Usamos los módulos ya importados arriba
    # (m1..m13) para que PyInstaller los detecte y empaquete.
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
        ("branch_opening_hours", m14.upgrade),
        ("branch_integration_profiles", m15.upgrade),
        ("admin_ai_settings", m16.upgrade),
        ("ai_permissions", m17.upgrade),
        ("skill_level_to_users", m18.upgrade),
        ("min_stock_to_products", m19.upgrade),
        ("email_to_clients", m20.upgrade),
        ("advance_payment_to_appointments", m21.upgrade),
        ("commission_rate_to_users", m22.upgrade),
        ("temp_branch_to_users", m23.upgrade),
        ("cash_close_tables", m24.upgrade),
        ("commission_rate_to_services", m25.upgrade),
        ("qr_image_url_to_branches", m26.upgrade),
        ("commission_payments_table", m27.upgrade),
        ("marketplace_products_table", m28.upgrade),
        ("ci_marketplace_to_clients", m29.upgrade),
        ("maps_url_to_branches", m30.upgrade),
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
        origin = request.headers.get("origin", "")
        headers = {}
        if origin:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "type": type(exc).__name__},
            headers=headers,
        )

    allow_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:3000",
        "tauri://localhost",
        "http://tauri.localhost",
    ]
    # En Cloud permitimos cualquier origen (cubre admin web + app mobile)
    if settings.environment == "production":
        allow_origins = ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=settings.environment != "production",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check para que el frontend sepa que el backend ya arrancó
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # Servido de imágenes subidas (catálogo de pestañas, etc.) en /media
    from app.core.media import MEDIA_URL_PREFIX, ensure_media_dirs
    media_root = ensure_media_dirs()
    app.mount(MEDIA_URL_PREFIX, StaticFiles(directory=media_root), name="media")

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
    app.include_router(reports_controller.router)
    app.include_router(admin.router)
    app.include_router(admin_ai_controller.router)
    app.include_router(notifications_router)
    app.include_router(commission_payments_router)
    app.include_router(marketplace_router)
    app.include_router(marketplace_proxy_router)
    app.include_router(marketplace_booking_router)
    app.include_router(auth_routes.router)

    @app.websocket("/ws/branch/{branch_id}")
    async def ws_branch(websocket: WebSocket, branch_id: int, token: str | None = None):
        if token is not None:
            try:
                decode_token(token)
            except JWTError:
                await websocket.close(code=1008)
                return
        await ws_manager.connect(websocket, branch_id)
        try:
            while True:
                text = await websocket.receive_text()
                if text == "ping":
                    await websocket.send_text("pong")
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket, branch_id)

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