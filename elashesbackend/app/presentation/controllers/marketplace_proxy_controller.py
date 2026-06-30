"""
Proxy transparente hacia backend_marketplace.

Cualquier petición a  /marketplace-proxy/<path>  se reenvía a
settings.marketplace_backend_url/<path>  y la respuesta llega al frontend
como si viniera directamente de elashesbackend.

El frontend solo necesita VITE_API_URL; nunca llama al puerto 8001 directamente.
"""
import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from app.config.settings import settings

router = APIRouter(prefix="/marketplace-proxy", tags=["Marketplace Proxy"])

TIMEOUT = httpx.Timeout(30.0)


@router.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(path: str, request: Request) -> Response:
    target_url = f"{settings.marketplace_backend_url.rstrip('/')}/{path}"

    # Reenvía query params
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    # Filtra headers que no deben reenviarse
    skip = {"host", "content-length", "transfer-encoding"}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}

    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
    except httpx.ConnectError:
        return Response(
            content=b'{"detail":"backend_marketplace no disponible. Verifica que est\xc3\xa9 corriendo."}',
            status_code=503,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        return Response(
            content=b'{"detail":"Tiempo de espera agotado al conectar con backend_marketplace."}',
            status_code=504,
            media_type="application/json",
        )

    # Cabeceras de respuesta (excluye las que FastAPI maneja sola)
    skip_resp = {"content-encoding", "transfer-encoding", "content-length", "connection"}
    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in skip_resp}

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
