import { useState } from "react";
import { Printer, X, List, Columns3 } from "lucide-react";
import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";

type PrintMode = "planner" | "stations";

type Props = {
  tickets: TicketItem[];
  professionals: ProfessionalForSelect[];
  selectedDate: string;
  initialMode: PrintMode;
  onClose: () => void;
};

const GRID_FIRST_HOUR = 9;
const GRID_LAST_HOUR = 20;
const STATION_COUNT = 8;

function parseTicketDate(value: string) {
  if (!value) return new Date("");
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTz) return new Date(value);
  const [datePart, timePartRaw = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePartRaw.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDayTickets(tickets: TicketItem[], dateKey: string) {
  return tickets
    .filter((t) => {
      const d = parseTicketDate(t.start_time);
      return !Number.isNaN(d.getTime()) && toIsoDate(d) === dateKey;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// ─── Preview dentro del modal (solo referencia visual) ─────────────────────

function PreviewPlannerTable({ tickets }: { tickets: TicketItem[] }) {
  if (tickets.length === 0)
    return <p className="py-8 text-center text-sm text-gray-400">Sin reservas para este día.</p>;
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-[#094732] text-white">
          {["Hora", "Cliente", "Servicio(s)", "Operaria", "Estado"].map((h) => (
            <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tickets.map((t, i) => {
          const start = parseTicketDate(t.start_time);
          const isCancelled = t.status === "cancelled";
          const services = t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? "—");
          return (
            <tr key={t.id} className={isCancelled ? "bg-rose-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className={`border border-gray-200 px-2 py-1 font-mono font-semibold whitespace-nowrap ${isCancelled ? "line-through text-gray-400" : ""}`}>
                {`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`}
              </td>
              <td className={`border border-gray-200 px-2 py-1 font-medium ${isCancelled ? "line-through text-gray-400" : ""}`}>{t.client_name || "—"}</td>
              <td className={`border border-gray-200 px-2 py-1 ${isCancelled ? "line-through text-gray-400" : ""}`}>{services}</td>
              <td className={`border border-gray-200 px-2 py-1 ${isCancelled ? "line-through text-gray-400" : ""}`}>{t.professional_name ?? "Sin asignar"}</td>
              <td className="border border-gray-200 px-2 py-1">
                {isCancelled
                  ? <span className="font-bold text-rose-600">✕ Cancelado</span>
                  : <span className="text-emerald-700">{t.status}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PreviewStationsGrid({ tickets, professionals }: { tickets: TicketItem[]; professionals: ProfessionalForSelect[] }) {
  const pros = professionals.slice(0, STATION_COUNT);
  const hours = Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i);

  const ticketsByCell = new Map<string, TicketItem[]>();
  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime())) continue;
    const hour = start.getHours();
    if (hour < GRID_FIRST_HOUR || hour > GRID_LAST_HOUR) continue;
    const pid = t.professional_id;
    let col = 0;
    if (pid != null) {
      const idx = pros.findIndex((p) => p.id === pid);
      col = idx >= 0 ? idx : 0;
    }
    const key = `${hour}__${col}`;
    const list = ticketsByCell.get(key) ?? [];
    list.push(t);
    ticketsByCell.set(key, list);
  }

  const colCount = Math.max(pros.length, STATION_COUNT);

  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="bg-[#094732] text-white">
          <th className="border border-gray-300 px-2 py-1.5 text-center font-bold w-16">HORA</th>
          {Array.from({ length: colCount }, (_, i) => (
            <th key={i} className="border border-gray-300 px-1 py-1.5 text-center font-bold">
              <div className="text-sm font-black">{i + 1}</div>
              {pros[i] && <div className="text-[9px] font-normal opacity-80 truncate max-w-20">{pros[i].username}</div>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hours.map((hour) => (
          <tr key={hour}>
            <td className="border border-gray-300 px-2 py-1 text-center font-mono text-xs font-bold bg-gray-50 w-16">
              {String(hour).padStart(2, "0")}:00
            </td>
            {Array.from({ length: colCount }, (_, col) => {
              const cell = ticketsByCell.get(`${hour}__${col}`) ?? [];
              return (
                <td key={col} className="border border-gray-300 px-1 py-1 align-top min-h-10 h-10">
                  {cell.map((t) => {
                    const isCancelled = t.status === "cancelled";
                    return (
                      <div key={t.id} className={`text-[10px] leading-tight ${isCancelled ? "line-through text-gray-400" : "font-medium text-gray-800"}`}>
                        {isCancelled && <span className="font-bold text-rose-500 no-underline">✕ </span>}
                        {t.client_name || "—"}
                      </div>
                    );
                  })}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Generadores de HTML para la ventana de impresión ──────────────────────

function buildStationsHTML(
  tickets: TicketItem[],
  professionals: ProfessionalForSelect[],
  dateLabel: string,
  selectedDate: string
): string {
  const pros = professionals.slice(0, STATION_COUNT);
  const colCount = Math.max(pros.length, STATION_COUNT);
  const hours = Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i);

  const ticketsByCell = new Map<string, TicketItem[]>();
  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime())) continue;
    const hour = start.getHours();
    if (hour < GRID_FIRST_HOUR || hour > GRID_LAST_HOUR) continue;
    const pid = t.professional_id;
    let col = 0;
    if (pid != null) {
      const idx = pros.findIndex((p) => p.id === pid);
      col = idx >= 0 ? idx : 0;
    }
    const key = `${hour}__${col}`;
    const list = ticketsByCell.get(key) ?? [];
    list.push(t);
    ticketsByCell.set(key, list);
  }

  const headerCols = Array.from({ length: colCount }, (_, i) => {
    const name = pros[i]?.username ?? "";
    return `<th style="border:1px solid #333;padding:4px 2px;text-align:center;font-size:11px;background:#094732;color:white;">
      <div style="font-size:13px;font-weight:900;">${i + 1}</div>
      ${name ? `<div style="font-size:9px;font-weight:400;">${name}</div>` : ""}
    </th>`;
  }).join("");

  const bodyRows = hours.map((hour) => {
    const timeTd = `<td style="border:1px solid #333;padding:4px 6px;text-align:center;font-family:monospace;font-weight:700;font-size:11px;background:#f5f5f5;white-space:nowrap;">${String(hour).padStart(2, "0")}:00</td>`;
    const cells = Array.from({ length: colCount }, (_, col) => {
      const cell = ticketsByCell.get(`${hour}__${col}`) ?? [];
      const content = cell.map((t) => {
        const isCancelled = t.status === "cancelled";
        const service = t.service_names?.[0] ?? t.service_name ?? "";
        return isCancelled
          ? `<div style="text-decoration:line-through;color:#aaa;font-size:10px;">✕ ${t.client_name ?? "—"}</div>`
          : `<div style="font-size:11px;font-weight:600;line-height:1.3;">${t.client_name ?? "—"}</div>${service ? `<div style="font-size:9px;color:#555;">${service}</div>` : ""}`;
      }).join("");
      return `<td style="border:1px solid #333;padding:3px 4px;vertical-align:top;min-height:38px;height:38px;">${content}</td>`;
    }).join("");
    return `<tr>${timeTd}${cells}</tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Agenda ${selectedDate}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:white;}
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 14px 8px;border-bottom:2px solid #094732;}
    .page-header h1{font-size:15px;color:#094732;font-weight:900;}
    .page-header .day-box{border:2px solid #094732;padding:4px 10px;text-align:center;}
    .page-header .day-box .label{font-size:9px;font-weight:700;text-transform:uppercase;color:#666;}
    .page-header .day-box .value{font-size:16px;font-weight:900;color:#094732;}
    .content{padding:8px 14px;}
    table{width:100%;border-collapse:collapse;}
    @media print{@page{size:landscape;margin:8mm;}body{font-size:10px;}}
  </style>
</head>
<body>
  <div class="page-header">
    <div>
      <h1>Agenda del Día &mdash; Elashes</h1>
      <p style="font-size:11px;color:#555;margin-top:2px;">${dateLabel}</p>
      <p style="font-size:10px;color:#777;margin-top:1px;">${tickets.length} reserva${tickets.length !== 1 ? "s" : ""} &nbsp;·&nbsp; ${tickets.filter((t) => t.status === "cancelled").length} cancelada${tickets.filter((t) => t.status === "cancelled").length !== 1 ? "s" : ""}</p>
    </div>
    <div class="day-box">
      <div class="label">Puestos</div>
      <div class="value">1 &ndash; ${colCount}</div>
    </div>
  </div>
  <div class="content">
    <table>
      <thead><tr>
        <th style="border:1px solid #333;padding:4px 6px;text-align:center;font-size:11px;background:#094732;color:white;width:52px;">HORA</th>
        ${headerCols}
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  <div style="margin-top:10px;font-size:9px;color:#999;text-align:right;padding:0 14px 10px;">Impreso: ${new Date().toLocaleString("es-BO")}</div>
</body>
</html>`;
}

function buildPlannerHTML(tickets: TicketItem[], dateLabel: string, selectedDate: string): string {
  const rows = tickets.map((t, i) => {
    const start = parseTicketDate(t.start_time);
    const isCancelled = t.status === "cancelled";
    const services = t.service_names?.length ? t.service_names.join(" · ") : (t.service_name ?? "—");
    const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    const bg = isCancelled ? "#fff0f0" : i % 2 === 0 ? "#fff" : "#f9f9f9";
    const textStyle = isCancelled ? "text-decoration:line-through;color:#aaa;" : "";
    return `<tr style="background:${bg};">
      <td style="border:1px solid #ddd;padding:5px 8px;font-family:monospace;font-weight:700;${textStyle}">${timeStr}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;font-weight:600;${textStyle}">${t.client_name ?? "—"}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;${textStyle}">${services}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;${textStyle}">${t.professional_name ?? "Sin asignar"}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;">${isCancelled ? '<span style="color:#dc2626;font-weight:700;">✕ Cancelado</span>' : `<span style="color:#059669;">${t.status}</span>`}</td>
      <td style="border:1px solid #ddd;padding:5px 8px;font-family:monospace;color:#2563eb;">${t.ticket_code ?? `#${t.id}`}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Agenda ${selectedDate}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:white;}
    .page-header{padding:12px 16px 8px;border-bottom:2px solid #094732;}
    .page-header h1{font-size:15px;color:#094732;font-weight:900;}
    .content{padding:10px 16px;}
    table{width:100%;border-collapse:collapse;font-size:11px;}
    th{background:#094732;color:white;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;}
    @media print{@page{size:portrait;margin:10mm;}}
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Agenda del Día &mdash; Elashes</h1>
    <p style="font-size:11px;color:#555;margin-top:2px;">${dateLabel}</p>
    <p style="font-size:10px;color:#777;margin-top:1px;">${tickets.length} reserva${tickets.length !== 1 ? "s" : ""} &nbsp;·&nbsp; ${tickets.filter((t) => t.status === "cancelled").length} cancelada${tickets.filter((t) => t.status === "cancelled").length !== 1 ? "s" : ""}</p>
  </div>
  <div class="content">
    <table>
      <thead><tr>
        <th>Hora</th><th>Cliente</th><th>Servicio(s)</th><th>Operaria</th><th>Estado</th><th>Código</th>
      </tr></thead>
      <tbody>${rows.length ? rows : '<tr><td colspan="6" style="padding:20px;text-align:center;color:#aaa;">Sin reservas para este día.</td></tr>'}</tbody>
    </table>
  </div>
  <div style="margin-top:12px;font-size:9px;color:#999;text-align:right;padding:0 16px 10px;">Impreso: ${new Date().toLocaleString("es-BO")}</div>
</body>
</html>`;
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function PrintAgendaModal({ tickets, professionals, selectedDate, initialMode, onClose }: Props) {
  const [mode, setMode] = useState<PrintMode>(initialMode);
  const dayTickets = getDayTickets(tickets, selectedDate);

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    const html =
      mode === "stations"
        ? buildStationsHTML(dayTickets, professionals, dateLabel, selectedDate)
        : buildPlannerHTML(dayTickets, dateLabel, selectedDate);

    const win = window.open("", "_blank", "width=1100,height=750");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 450);
  };

  const tabBtn = (m: PrintMode, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
        mode === m ? "bg-[#094732] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
      <div className="w-full max-w-6xl rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Vista previa de impresión</h2>
            <p className="text-xs text-slate-500 capitalize">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {tabBtn("planner", "Planilla horaria", List)}
              {tabBtn("stations", "Puestos 1–8", Columns3)}
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-[#094732] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#0b5c40] transition-colors"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-600">
          <span><strong className="text-slate-800">{dayTickets.length}</strong> reservas</span>
          <span><strong className="text-emerald-700">{dayTickets.filter((t) => t.status === "completed").length}</strong> completadas</span>
          <span><strong className="text-amber-600">{dayTickets.filter((t) => t.status === "pending" || t.status === "in_service").length}</strong> en curso</span>
          <span><strong className="text-rose-600">{dayTickets.filter((t) => t.status === "cancelled").length}</strong> canceladas</span>
          <span className="ml-auto text-slate-400 italic">Las canceladas aparecen tachadas en la impresión</span>
        </div>

        {/* Preview */}
        <div className="overflow-x-auto p-5">
          {mode === "planner"
            ? <PreviewPlannerTable tickets={dayTickets} />
            : <PreviewStationsGrid tickets={dayTickets} professionals={professionals} />
          }
        </div>
      </div>
    </div>
  );
}
