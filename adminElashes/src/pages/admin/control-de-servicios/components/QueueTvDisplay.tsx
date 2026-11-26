/**
 * QueueTvDisplay — Pantalla TV de cola de atención (sala de espera).
 *
 * Pensada para verse desde lejos y para aguantar varios servicios a la vez:
 *  - EN SERVICIO: cuadrícula de tarjetas iguales que se acomoda según cuántas haya
 *    (1, 2, 4, 6 u 8 por pantalla; si hay más, rota de página sola).
 *  - EN ESPERA: columna ordenada a la derecha con el SIGUIENTE destacado.
 *  - Nada se sale de la pantalla: todo se ajusta al alto y ancho disponibles.
 * Un ticket grupal (varios servicios) es una sola tarjeta con todos sus servicios.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Maximize2, Minimize2, Scissors, Tv2, User, X } from "lucide-react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { HYGIENE_NOTICE } from "../../../../core/constants/hygieneNotice";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRAND = "#094732";
const GOLD = "#9F8351";
/** Tarjetas por página en "En servicio" (cuadrícula de 4 columnas x 2 filas como máximo). */
const PAGE_SIZE = 8;
const PAGE_SECONDS = 10;
/** Filas visibles en "En espera" (el resto se resume en "+N más"). */
const WAITING_VISIBLE = 7;

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function minutesBetween(startIso: string, endIso: string) {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

function durationLabel(mins: number) {
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function serviceNames(ticket: TicketItem): string[] {
  if (ticket.service_names && ticket.service_names.length > 0) return ticket.service_names;
  if (ticket.service_name) return [ticket.service_name];
  return ["Sin servicio"];
}

/** "Cliente Mostrador — Sucursal Norte" → "Cliente Mostrador" (la sucursal ya va en el título). */
function clientLabel(ticket: TicketItem) {
  return (ticket.client_name ?? "Cliente").split(" — ")[0].trim() || "Cliente";
}

const ticketCode = (t: TicketItem) => t.ticket_code ?? `#${t.id}`;

/** Un reloj compartido para todo el tablero (una sola actualización por segundo). */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

/**
 * Pantalla completa real (oculta el navegador). Intenta entrar al abrir el tablero; si el navegador no lo
 * permite, queda el botón. Al salir con Esc el tablero sigue visible y el botón vuelve a "Pantalla completa".
 */
function useFullscreen(target: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const enter = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await (target.current ?? document.documentElement).requestFullscreen();
    } catch {
      /* el navegador lo bloqueó (sin gesto del usuario): queda el botón */
    }
  }, [target]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ya no estaba en pantalla completa */
    }
  }, []);

  return { isFullscreen, enter, exit, toggle: () => void (document.fullscreenElement ? exit() : enter()) };
}

/** Etiquetas de servicios. Los tamaños son relativos a la tarjeta (cqw), no a la pantalla. */
function ServiceChips({ names, max }: { names: string[]; max: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const chip = "gap-[1.6cqw] px-[3cqw] py-[1.4cqw] text-[length:clamp(0.75rem,4.5cqw,1.3rem)]";
  return (
    <div className="flex min-w-0 flex-wrap gap-[1.5cqw]">
      {shown.map((s, i) => (
        <span key={i} className={`inline-flex min-w-0 max-w-full items-center rounded-lg bg-[#eaf4ef] font-semibold text-[#094732] ${chip}`}>
          <Scissors className="h-[1em] w-[1em] shrink-0 opacity-70" />
          <span className="truncate">{s}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className={`inline-flex items-center rounded-lg bg-slate-100 font-bold text-slate-500 ${chip}`}>+{extra} más</span>
      )}
    </div>
  );
}

// ── En servicio ───────────────────────────────────────────────────────────────

function InServiceCard({ ticket, now, compact }: { ticket: TicketItem; now: number; compact: boolean }) {
  const names = serviceNames(ticket);
  const totalMin = Math.max(1, minutesBetween(ticket.start_time, ticket.end_time));
  const elapsedMin = Math.max(0, Math.floor((now - new Date(ticket.start_time).getTime()) / 60_000));
  const pct = Math.min(100, Math.round((elapsedMin / totalMin) * 100));
  const over = elapsedMin > totalMin;
  const operator = ticket.professional_name ?? "Sin operaria";
  const range = `${fmtTime(ticket.start_time)} – ${fmtTime(ticket.end_time)}`;

  // Todo el contenido escala con el ANCHO DE LA PROPIA TARJETA (cqw): con 1, 4 u 8 tarjetas
  // el código del ticket no se parte y nada queda cortado.
  return (
    <article className="@container flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dce5df] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-[3cqw] px-[4.5cqw] py-[2.6cqw] text-white" style={{ background: BRAND }}>
        <span className="min-w-0 truncate whitespace-nowrap font-mono text-[length:clamp(0.95rem,6.1cqw,2.4rem)] font-black tracking-tight">
          {ticketCode(ticket)}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-[length:clamp(0.8rem,3.8cqw,1.2rem)] font-semibold tabular-nums text-white/85 @md:flex">
          <Clock className="h-[1em] w-[1em]" />
          {range}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[3cqw] overflow-hidden p-[4.5cqw]">
        <p className="truncate text-[length:clamp(1.15rem,8.2cqw,2.8rem)] font-extrabold leading-tight text-slate-800">{clientLabel(ticket)}</p>

        <div className="flex items-center gap-[3cqw]">
          <span
            className="flex shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: GOLD, width: "clamp(1.9rem,11cqw,3.2rem)", height: "clamp(1.9rem,11cqw,3.2rem)" }}
          >
            <User className="h-[55%] w-[55%]" />
          </span>
          <div className="min-w-0">
            <p className="text-[length:clamp(0.62rem,3.2cqw,0.9rem)] font-bold uppercase leading-none tracking-widest text-slate-400">Te atiende</p>
            <p className="truncate text-[length:clamp(1rem,6.9cqw,2rem)] font-bold capitalize leading-tight text-slate-700">{operator}</p>
          </div>
        </div>

        <ServiceChips names={names} max={compact ? 2 : 4} />

        <div className="mt-auto space-y-[1.6cqw]">
          <div className="h-[clamp(0.45rem,2.4cqw,0.8rem)] overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-1000"
              style={{ width: `${pct}%`, background: over ? "#d97706" : BRAND }}
            />
          </div>
          <p className={`flex items-center justify-between gap-2 whitespace-nowrap text-[length:clamp(0.7rem,4cqw,1.15rem)] font-semibold tabular-nums ${over ? "text-amber-600" : "text-slate-500"}`}>
            <span className="truncate">{range} · {elapsedMin} de {durationLabel(totalMin)}</span>
            {over && <span className="shrink-0">Tiempo extra</span>}
          </p>
        </div>
      </div>
    </article>
  );
}

function InServiceBoard({ tickets, now }: { tickets: TicketItem[]; now: number }) {
  const pages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const [page, setPage] = useState(0);

  // Con más de 8 en servicio, rota de página sola.
  useEffect(() => {
    if (pages <= 1) { setPage(0); return; }
    const i = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_SECONDS * 1000);
    return () => clearInterval(i);
  }, [pages]);

  const safePage = Math.min(page, pages - 1);
  const visible = tickets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const n = visible.length;

  if (tickets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#c9dbd2] bg-white/60 p-8 text-center">
        <Tv2 className="mb-3 h-14 w-14 text-[#9bb8aa]" />
        <p className="text-[clamp(1.2rem,2vw,2rem)] font-bold text-[#6b8f7e]">Sin atenciones en curso</p>
        <p className="mt-1 text-[clamp(0.85rem,1.1vw,1.1rem)] text-[#9bb8aa]">Pronto te llamamos.</p>
      </div>
    );
  }

  // Columnas según cuántas tarjetas hay: se reparten el ancho y el alto por igual.
  const cols = n <= 1 ? "grid-cols-1" : n <= 4 ? "grid-cols-2" : n <= 6 ? "grid-cols-3" : "grid-cols-4";
  const rows = n <= 2 ? "grid-rows-1" : n <= 6 ? (n <= 4 ? "grid-rows-2" : "grid-rows-2") : "grid-rows-2";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className={`grid min-h-0 flex-1 gap-4 ${cols} ${rows} ${n === 1 ? "mx-auto w-full max-w-4xl" : ""}`}>
        {visible.map((t) => (
          <InServiceCard key={t.id} ticket={t} now={now} compact={n > 4} />
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i === safePage ? "w-6 bg-[#094732]" : "w-2 bg-slate-300"}`} />
          ))}
          <span className="ml-2">Página {safePage + 1} de {pages}</span>
        </div>
      )}
    </div>
  );
}

// ── En espera ─────────────────────────────────────────────────────────────────

function WaitingRow({ ticket, position }: { ticket: TicketItem; position: number }) {
  const first = position === 1;
  const names = serviceNames(ticket);
  const mins = minutesBetween(ticket.start_time, ticket.end_time);

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border bg-white px-4 ${
        first ? "border-2 py-4 shadow-md" : "border-slate-200 py-2.5 shadow-sm"
      }`}
      style={first ? { borderColor: GOLD } : undefined}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-black tabular-nums ${
          first ? "h-[clamp(2.2rem,3vw,3rem)] w-[clamp(2.2rem,3vw,3rem)] text-[clamp(1.1rem,1.6vw,1.6rem)] text-white" : "h-8 w-8 bg-slate-100 text-sm text-slate-500"
        }`}
        style={first ? { background: GOLD } : undefined}
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        {first && (
          <p className="text-[clamp(0.65rem,0.8vw,0.8rem)] font-extrabold uppercase tracking-widest" style={{ color: GOLD }}>
            Siguiente
          </p>
        )}
        <p className={`truncate font-bold text-slate-800 ${first ? "text-[clamp(1.1rem,1.7vw,1.7rem)]" : "text-[clamp(0.9rem,1.2vw,1.2rem)]"}`}>
          {clientLabel(ticket)}
        </p>
        <p className={`truncate text-slate-500 ${first ? "text-[clamp(0.8rem,1vw,1rem)]" : "text-[clamp(0.7rem,0.85vw,0.9rem)]"}`}>
          <span className="font-mono font-bold text-slate-600">{ticketCode(ticket)}</span> · {names.join(" + ")}
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums text-slate-400">
        <p className={`font-semibold ${first ? "text-[clamp(0.9rem,1.2vw,1.2rem)] text-slate-600" : "text-[clamp(0.75rem,0.9vw,0.95rem)]"}`}>{fmtTime(ticket.start_time)}</p>
        {mins > 0 && <p className="text-[clamp(0.65rem,0.8vw,0.8rem)]">{durationLabel(mins)}</p>}
      </div>
    </li>
  );
}

function WaitingColumn({ tickets }: { tickets: TicketItem[] }) {
  const visible = tickets.slice(0, WAITING_VISIBLE);
  const hidden = tickets.length - visible.length;

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <h2 className="mb-3 flex items-center gap-2 text-[clamp(0.8rem,1vw,1rem)] font-extrabold uppercase tracking-widest text-slate-500">
        En espera
        <span className="rounded-full px-2.5 py-0.5 text-white" style={{ background: GOLD }}>{tickets.length}</span>
      </h2>
      {tickets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-6 text-center">
          <p className="text-[clamp(1rem,1.4vw,1.4rem)] font-bold text-slate-400">Nadie en espera</p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          {visible.map((t, i) => (
            <WaitingRow key={t.id} ticket={t} position={i + 1} />
          ))}
          {hidden > 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 bg-white/70 py-2 text-center text-[clamp(0.8rem,1vw,1rem)] font-bold text-slate-500">
              +{hidden} más en espera
            </li>
          )}
        </ul>
      )}
    </aside>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface QueueTvDisplayProps {
  waitingTickets: TicketItem[];
  inServiceTickets: TicketItem[];
  onClose: () => void;
  branchName?: string;
}

export default function QueueTvDisplay({ waitingTickets, inServiceTickets, onClose, branchName }: QueueTvDisplayProps) {
  const now = useNow();
  const clock = useMemo(() => new Date(now), [now]);
  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);
  const { enter: enterFullscreen, exit: exitFullscreen } = fullscreen;

  // Al abrir el tablero entra solo a pantalla completa; al cerrarlo, sale.
  useEffect(() => {
    void enterFullscreen();
    return () => { void exitFullscreen(); };
  }, [enterFullscreen, exitFullscreen]);

  // En pantalla completa el cursor se oculta tras unos segundos sin moverlo (es una TV).
  const [cursorHidden, setCursorHidden] = useState(false);
  useEffect(() => {
    if (!fullscreen.isFullscreen) { setCursorHidden(false); return; }
    let timer = window.setTimeout(() => setCursorHidden(true), 3000);
    const wake = () => {
      setCursorHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorHidden(true), 3000);
    };
    window.addEventListener("mousemove", wake);
    return () => { window.clearTimeout(timer); window.removeEventListener("mousemove", wake); };
  }, [fullscreen.isFullscreen]);

  const timeLabel = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}:${String(clock.getSeconds()).padStart(2, "0")}`;
  const dateLabel = clock.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div ref={rootRef} className={`fixed inset-0 z-100 flex flex-col bg-[#f3f2f1] ${cursorHidden ? "cursor-none" : ""}`}>
      {/* Barra superior */}
      <header className="flex items-center justify-between gap-4 px-6 py-3 text-white shadow-md" style={{ background: BRAND, borderBottom: `3px solid ${GOLD}` }}>
        <div className="flex min-w-0 items-center gap-3">
          <Tv2 className="h-7 w-7 shrink-0 text-[#d8c7a4]" />
          <div className="min-w-0">
            <p className="truncate text-[clamp(1.1rem,1.7vw,1.7rem)] font-extrabold leading-tight">
              Cola de atención{branchName ? ` · ${branchName}` : ""}
            </p>
            <p className="text-[clamp(0.75rem,0.95vw,0.95rem)] capitalize text-white/70">{dateLabel}</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-xl bg-white/12 px-4 py-1.5 text-center">
            <span className="block text-[clamp(1.3rem,2vw,2rem)] font-black leading-none tabular-nums">{inServiceTickets.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">En servicio</span>
          </span>
          <span className="rounded-xl bg-white/12 px-4 py-1.5 text-center">
            <span className="block text-[clamp(1.3rem,2vw,2rem)] font-black leading-none tabular-nums text-[#d8c7a4]">{waitingTickets.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">En espera</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <p className="font-mono text-[clamp(1.4rem,2.4vw,2.4rem)] font-black tabular-nums">{timeLabel}</p>
          <button
            type="button"
            onClick={fullscreen.toggle}
            className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            title={fullscreen.isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-label={fullscreen.isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen.isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            title="Cerrar pantalla TV"
            aria-label="Cerrar pantalla TV"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Tablero: En servicio (grande) + En espera (columna) */}
      <main
        className={`grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 ${
          waitingTickets.length === 0
            ? "lg:grid-cols-[minmax(0,1fr)_clamp(11rem,15vw,15rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_clamp(19rem,29vw,31rem)]"
        }`}
      >
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-3 flex items-center gap-2 text-[clamp(0.8rem,1vw,1rem)] font-extrabold uppercase tracking-widest text-slate-500">
            En servicio
            <span className="rounded-full px-2.5 py-0.5 text-white" style={{ background: BRAND }}>{inServiceTickets.length}</span>
          </h2>
          <div className="min-h-0 flex-1">
            <InServiceBoard tickets={inServiceTickets} now={now} />
          </div>
        </section>

        <WaitingColumn tickets={waitingTickets} />
      </main>

      {/* Aviso para las clientas que esperan */}
      <div className="border-t border-emerald-200 bg-emerald-50 px-6 py-2.5 text-center text-[clamp(0.85rem,1.2vw,1.2rem)] font-semibold text-emerald-800">
        {HYGIENE_NOTICE}
      </div>
    </div>
  );
}
