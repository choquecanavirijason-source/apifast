import type { TicketItem } from "../../../core/services/agenda/agenda.service";
import { parseTicketDate } from "../calendar/dailyAgenda.utils";

/**
 * Ticket de atención (papel térmico de 80 mm) que se imprime al atender a la
 * clienta: sus datos, lo que solicitó y el detalle de la atención.
 *
 * Se imprime desde un marco oculto en la misma página: no depende de ventanas
 * emergentes, que el navegador bloquea cuando la impresión no sale directo de
 * un clic.
 */

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (value: number) => `Bs ${value.toFixed(2)}`;

const formatDate = (date: Date) =>
  date.toLocaleDateString("es-BO", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

const formatTime = (date: Date) =>
  date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });

type ServiceLine = { name: string; price: number | null };

/** Servicios de uno o varios tickets (una reserva con varios servicios tiene un ticket por servicio). */
function collectServices(tickets: TicketItem[]): ServiceLine[] {
  const lines: ServiceLine[] = [];
  for (const ticket of tickets) {
    const names = ticket.service_names?.length
      ? ticket.service_names
      : ticket.service_name
        ? [ticket.service_name]
        : [];
    const prices = ticket.service_prices?.length
      ? ticket.service_prices
      : ticket.service_price != null
        ? [ticket.service_price]
        : [];
    names.forEach((name, index) => {
      lines.push({ name, price: typeof prices[index] === "number" ? prices[index] : null });
    });
  }
  return lines;
}

export function buildAttentionTicketHtml(tickets: TicketItem[], printedAt: Date = new Date()): string {
  const main = tickets[0];
  const client = main.client;
  const clientName = client ? `${client.name} ${client.last_name ?? ""}`.trim() : main.client_name;
  const phone = client?.phone ?? main.client_phone ?? null;
  const age = client?.age ?? main.client_age ?? null;
  const eyeType = client?.eye_type_name ?? main.client_eye_type_name ?? null;
  // Alergias de ESTA atención (del ticket si es clienta de mostrador, si no de su ficha).
  const allergies = (main.allergies ?? "").trim();
  const branch = main.branch_name ?? client?.branch_name ?? main.client_branch_name ?? null;

  const starts = tickets.map((t) => parseTicketDate(t.start_time)).filter((d) => !Number.isNaN(d.getTime()));
  const ends = tickets.map((t) => parseTicketDate(t.end_time)).filter((d) => !Number.isNaN(d.getTime()));
  const start = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
  const end = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

  const codes = tickets.map((t) => t.ticket_code ?? `#${t.id}`).join(", ");
  const professionals = Array.from(new Set(tickets.map((t) => t.professional_name).filter(Boolean)));
  const services = collectServices(tickets);
  const priced = services.filter((s) => s.price != null);
  const total = priced.reduce((sum, s) => sum + (s.price ?? 0), 0);

  const row = (label: string, value: unknown) =>
    value === null || value === undefined || value === ""
      ? ""
      : `<div class="row"><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(value)}</span></div>`;

  const serviceRows = services.length
    ? services
        .map(
          (s) =>
            `<div class="svc"><span>${escapeHtml(s.name)}</span><span>${s.price != null ? money(s.price) : ""}</span></div>`,
        )
        .join("")
    : `<div class="muted">Sin servicios registrados</div>`;

  const schedule =
    start && end
      ? `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`
      : start
        ? `${formatDate(start)} · ${formatTime(start)}`
        : null;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${escapeHtml(codes)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { width: 72mm; margin: 0 auto; padding: 4mm 0; font-family: "Courier New", ui-monospace, monospace; font-size: 12px; color: #000; }
  .center { text-align: center; }
  .brand { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
  .title { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .code { font-size: 16px; font-weight: 700; margin: 6px 0 2px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .alert { border: 2px solid #000; padding: 4px 5px; margin: 6px 0; }
  .alert .t { font-weight: 700; font-size: 13px; text-align: center; letter-spacing: 1px; }
  .alert .b { font-weight: 700; font-size: 13px; margin-top: 2px; word-break: break-word; }
  .h { font-weight: 700; text-transform: uppercase; font-size: 11px; margin-bottom: 3px; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .row .k { flex: 0 0 auto; }
  .row .v { text-align: right; font-weight: 700; word-break: break-word; }
  .svc { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .svc span:first-child { word-break: break-word; }
  .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 3px; }
  .muted { color: #444; font-size: 11px; }
  .foot { margin-top: 8px; font-size: 11px; }
</style>
</head>
<body>
  <div class="center">
    <div class="brand">E-LASHES</div>
    <div class="title">TICKET DE ATENCIÓN</div>
    <div class="code">${escapeHtml(codes)}</div>
    ${branch ? `<div class="muted">${escapeHtml(branch)}</div>` : ""}
  </div>
  <div class="sep"></div>

  ${
    allergies
      ? `<div class="alert"><div class="t">!! ALERGIAS !!</div><div class="b">${escapeHtml(allergies)}</div></div>`
      : main.allergies_confirmed
        ? `<div class="muted center">Alergias: ninguna</div>`
        : `<div class="muted center">Alergias: sin confirmar</div>`
  }

  <div class="h">Clienta</div>
  ${row("Nombre", clientName)}
  ${row("Teléfono", phone)}
  ${row("Edad", age != null ? `${age} años` : null)}
  ${row("Tipo de ojo", eyeType)}
  <div class="sep"></div>

  <div class="h">Atención solicitada</div>
  ${serviceRows}
  ${priced.length ? `<div class="total"><span>TOTAL</span><span>${money(total)}</span></div>` : ""}
  <div class="sep"></div>

  <div class="h">Detalle</div>
  ${row("Operaria", professionals.join(", "))}
  ${row("Horario", schedule)}
  ${row("Impreso", `${formatDate(printedAt)} ${formatTime(printedAt)}`)}
  <div class="sep"></div>
  <div class="center foot">¡Gracias por tu visita!</div>
</body>
</html>`;
}

const PRINT_ON_START_KEY = "queue-print-on-start";

/** ¿Imprimir el ticket al iniciar una atención? Se recuerda por navegador (cada caja tiene su impresora). Activado por defecto. */
export function isPrintOnStartEnabled(): boolean {
  try {
    return localStorage.getItem(PRINT_ON_START_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setPrintOnStartEnabled(value: boolean): void {
  try {
    localStorage.setItem(PRINT_ON_START_KEY, value ? "1" : "0");
  } catch {
    // sin localStorage (modo privado): vale solo para esta sesión
  }
}

/** Imprime el ticket de atención. Devuelve false si no hay nada que imprimir o el navegador no pudo. */
export function printAttentionTicket(tickets: TicketItem[]): boolean {
  if (typeof document === "undefined" || tickets.length === 0) return false;

  const html = buildAttentionTicketHtml(tickets);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return false;
  }

  const cleanup = () => iframe.remove();
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  // Da un instante a que el marco pinte antes de abrir el diálogo de impresión.
  window.setTimeout(() => {
    try {
      frameWindow.onafterprint = cleanup;
      frameWindow.focus();
      frameWindow.print();
    } catch {
      cleanup();
    }
    // Respaldo: algunos navegadores no disparan afterprint.
    window.setTimeout(cleanup, 60_000);
  }, 150);
  return true;
}
