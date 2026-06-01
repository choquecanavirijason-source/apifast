/**
 * QueueTvDisplay — Pantalla TV de cola de atención.
 *
 * Diseñado para mostrarse en una TV o monitor de sala de espera.
 * Muestra el turno actual, el próximo y la cola simplificada.
 * - Ticket grupal  → todos los servicios en una sola card, tiempo total correcto.
 * - Ticket suelto  → cada ticket por separado.
 */
import { useEffect, useState } from "react";
import { Scissors, User, Clock, X, Tv2 } from "lucide-react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function durationLabel(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function serviceNames(ticket: TicketItem): string[] {
  if (ticket.service_names && ticket.service_names.length > 0) return ticket.service_names;
  if (ticket.service_name) return [ticket.service_name];
  return ["Sin servicio"];
}

function isGrouped(ticket: TicketItem): boolean {
  return (ticket.service_names?.length ?? 0) > 1 ||
    (ticket.service_ids?.length ?? 0) > 1;
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function ActiveTicketPanel({ ticket }: { ticket: TicketItem | null }) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const elapsedLabel = ticket
    ? (() => {
        const sec = Math.floor((tick - new Date(ticket.start_time).getTime()) / 1000);
        if (sec < 0) return "";
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, "0")} transcurrido`;
      })()
    : "";

  if (!ticket) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-8 text-center">
        <Tv2 className="mb-3 h-12 w-12 text-blue-300" />
        <p className="text-xl font-semibold text-blue-400">Sin atención activa</p>
        <p className="mt-1 text-sm text-blue-300">Esperando inicio de turno…</p>
      </div>
    );
  }

  const svcs = serviceNames(ticket);
  const grouped = isGrouped(ticket);
  const dur = durationLabel(ticket.start_time, ticket.end_time);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
          En atención
        </span>
        {grouped && (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            Ticket grupal · {svcs.length} servicios
          </span>
        )}
      </div>

      {/* Código de ticket */}
      <p className="font-mono text-4xl font-black tracking-tight text-blue-700">
        {ticket.ticket_code ?? `#${ticket.id}`}
      </p>

      {/* Cliente */}
      <p className="text-2xl font-bold text-slate-800">{ticket.client_name}</p>

      {/* Servicios */}
      <div className="flex flex-wrap gap-2">
        {svcs.map((s, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            <Scissors className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            {s}
          </span>
        ))}
      </div>

      {/* Footer: operaria + tiempo */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-slate-500">
          <User className="h-4 w-4" />
          <span className="text-sm font-semibold">{ticket.professional_name ?? "Sin operaria"}</span>
        </div>
        <div className="flex items-center gap-2 text-blue-600">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums">
            {fmtTime(ticket.start_time)} – {fmtTime(ticket.end_time)}
            {dur ? ` (${dur})` : ""}
          </span>
        </div>
        {elapsedLabel && (
          <span className="text-[11px] tabular-nums text-slate-400">{elapsedLabel}</span>
        )}
      </div>
    </div>
  );
}

function NextTicketPanel({ ticket, queueCount }: { ticket: TicketItem | null; queueCount: number }) {
  if (!ticket) {
    return (
      <div className="flex w-64 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-5 text-center">
        <p className="text-sm font-semibold text-orange-400">Cola vacía</p>
      </div>
    );
  }

  const svcs = serviceNames(ticket);
  const grouped = isGrouped(ticket);

  return (
    <div className="flex w-64 shrink-0 flex-col gap-3 rounded-2xl border border-orange-300 bg-white p-5 shadow">
      <span className="rounded-full bg-orange-500 px-3 py-0.5 text-center text-[10px] font-bold uppercase tracking-widest text-white">
        Próximo
      </span>
      <p className="font-mono text-2xl font-black text-orange-600">
        {ticket.ticket_code ?? `#${ticket.id}`}
      </p>
      <p className="text-base font-bold text-slate-700">{ticket.client_name}</p>
      <div className="flex flex-wrap gap-1">
        {svcs.map((s, i) => (
          <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {s}
          </span>
        ))}
      </div>
      {grouped && (
        <span className="text-[10px] font-semibold text-indigo-500">
          Ticket grupal · {svcs.length} servicios
        </span>
      )}
      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-slate-400">
        <Clock className="h-3.5 w-3.5" />
        {fmtTime(ticket.start_time)} · {durationLabel(ticket.start_time, ticket.end_time)}
      </div>
      {queueCount > 1 && (
        <p className="text-center text-[10px] font-semibold text-slate-400">
          +{queueCount - 1} en espera
        </p>
      )}
    </div>
  );
}

function QueueRow({ ticket, index }: { ticket: TicketItem; index: number }) {
  const svcs = serviceNames(ticket);
  const grouped = isGrouped(ticket);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{index + 1}</span>
      <p className="font-mono text-sm font-bold text-slate-700">
        {ticket.ticket_code ?? `#${ticket.id}`}
      </p>
      <p className="flex-1 truncate text-sm font-semibold text-slate-600">{ticket.client_name}</p>
      <div className="hidden flex-wrap gap-1 sm:flex">
        {svcs.slice(0, 2).map((s, i) => (
          <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {s}
          </span>
        ))}
        {svcs.length > 2 && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            +{svcs.length - 2}
          </span>
        )}
      </div>
      {grouped && (
        <span className="shrink-0 text-[10px] font-semibold text-indigo-400">Grupal</span>
      )}
      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
        {fmtTime(ticket.start_time)}
        {durationLabel(ticket.start_time, ticket.end_time) ? ` · ${durationLabel(ticket.start_time, ticket.end_time)}` : ""}
      </span>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface QueueTvDisplayProps {
  waitingTickets: TicketItem[];
  inServiceTickets: TicketItem[];
  onClose: () => void;
  branchName?: string;
}

export default function QueueTvDisplay({
  waitingTickets,
  inServiceTickets,
  onClose,
  branchName,
}: QueueTvDisplayProps) {
  const [clockNow, setClockNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLabel = `${String(clockNow.getHours()).padStart(2, "0")}:${String(clockNow.getMinutes()).padStart(2, "0")}:${String(clockNow.getSeconds()).padStart(2, "0")}`;
  const dateLabel = clockNow.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" });

  const activeTicket = inServiceTickets[0] ?? null;
  const nextTicket = waitingTickets[0] ?? null;
  const queueRest = waitingTickets.slice(1);

  return (
    <div className="fixed inset-0 z-100 flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Tv2 className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-bold text-slate-800">
              Cola de atención{branchName ? ` · ${branchName}` : ""}
            </p>
            <p className="text-[11px] capitalize text-slate-400">{dateLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="font-mono text-2xl font-black tabular-nums text-slate-700">{timeLabel}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar pantalla TV"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 gap-4 overflow-hidden p-5">
        {/* Panel izquierdo: activo + próximo */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          {/* En atención */}
          <ActiveTicketPanel ticket={activeTicket} />

          {/* Próximo + cola */}
          <div className="flex gap-4">
            <NextTicketPanel ticket={nextTicket} queueCount={waitingTickets.length} />

            {/* Resto de la cola */}
            {queueRest.length > 0 && (
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  En espera ({queueRest.length})
                </p>
                {queueRest.map((t, i) => (
                  <QueueRow key={t.id} ticket={t} index={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho: EN SERVICIO (si hay más de 1) */}
        {inServiceTickets.length > 1 && (
          <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              En servicio ({inServiceTickets.length})
            </p>
            {inServiceTickets.map((t) => {
              const svcs = serviceNames(t);
              return (
                <div key={t.id} className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="font-mono text-sm font-black text-blue-700">
                    {t.ticket_code ?? `#${t.id}`}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-700">{t.client_name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{svcs.join(" · ")}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-500">
                    <User className="h-3 w-3" />
                    {t.professional_name ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticker inferior */}
      <div className="border-t border-slate-200 bg-white px-6 py-2">
        <p className="text-[11px] text-slate-400">
          <span className="font-semibold text-blue-600">{inServiceTickets.length}</span> en servicio ·{" "}
          <span className="font-semibold text-orange-500">{waitingTickets.length}</span> en espera ·
          Actualización automática cada 15s
        </p>
      </div>
    </div>
  );
}
