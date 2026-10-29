"""Diseño común de los correos a clientas (recordatorios y comunicados).

Los estilos van en línea porque Gmail y Outlook ignoran casi todo el <style>.
Quien llama escapa cualquier dato de la BD o del panel antes de pasarlo.
"""
from html import escape

AUTOMATIC_FOOTER = "Este es un mensaje automático; no respondas a este correo."


def paragraph_html(text: str) -> str:
    """Texto libre del panel, escapado y con los saltos de línea respetados."""
    return escape(text).replace("\n", "<br>")


def render_email(title: str, content_html: str, footer: str = AUTOMATIC_FOOTER) -> str:
    """Página completa: cabecera Elashes, título, contenido y pie.
    title y footer se escapan aquí; content_html ya debe venir escapado."""
    return f"""<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#f7f2f4;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#2d1f27;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">Elashes</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 6px;color:#2d1f27;font-size:18px;font-weight:700;">{escape(title)}</p>
{content_html}
</td></tr>
<tr><td style="padding:16px 28px;background:#fbf7f9;color:#a8949f;font-size:11px;">{escape(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""
