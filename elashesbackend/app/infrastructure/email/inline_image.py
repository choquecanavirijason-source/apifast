"""
Imágenes incrustadas en el correo (CID, RFC 2392): viajan dentro del mensaje
como parte "inline" y el HTML las muestra con src="cid:...".

Así se ven aunque el servidor no tenga URL pública, no dependen de que el
archivo siga existiendo y los clientes de correo no las bloquean como
"contenido remoto". (Las imágenes en base64 dentro del HTML no sirven: Gmail
las elimina.)
"""
import base64
import os
from dataclasses import dataclass
from email.utils import make_msgid
from typing import Iterable, Optional

_SUBTYPES = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp", ".bmp": "bmp"}


@dataclass(frozen=True)
class InlineImage:
    # Sin los <> del encabezado Content-ID.
    cid: str
    data: bytes
    subtype: str
    filename: str

    @property
    def src(self) -> str:
        return f"cid:{self.cid}"


def inline_image(data: Optional[bytes], source_path: str, filename: str) -> Optional[InlineImage]:
    """None si no hay datos o la extensión no es de imagen. filename es el
    nombre que verá la clienta si su programa ofrece guardarla."""
    ext = os.path.splitext(source_path)[1].lower()
    if not data or ext not in _SUBTYPES:
        return None
    return InlineImage(
        cid=make_msgid(domain="elashes")[1:-1],
        data=data,
        subtype=_SUBTYPES[ext],
        filename=f"{filename}{'.jpg' if ext == '.jpeg' else ext}",
    )


def with_data_uris(html: str, images: Iterable[InlineImage]) -> str:
    """Para mostrar el correo en el navegador (vista previa del panel): fuera
    de un programa de correo, "cid:" no apunta a nada."""
    for image in images:
        encoded = base64.b64encode(image.data).decode("ascii")
        html = html.replace(image.src, f"data:image/{image.subtype};base64,{encoded}")
    return html
