import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { AgendaService, type TicketItem } from "../../../../core/services/agenda/agenda.service";
import { STATUS_LABELS } from "../calendar.constants";
import { parseTicketDate, ticketCardClass } from "../dailyAgenda.utils";

/** Tipo de dato que usa el arrastre desde este panel hacia el calendario. */
export const TICKET_DRAG_MIME = "application/x-agenda-ticket";

type TicketsSidePanelProps = {
  branchId: number | null;
  /** Cambia cuando la agenda se actualiza, para recargar la lista. */
  refreshKey: number;
  onClose: () => void;
  /** Clic en un ticket: ir a su fecha y abrir la edición. */
  onOpenTicket: (ticket: TicketItem) => void;
  /** Avisa qué ticket se está arrastrando (el calendario lo necesita al soltar). */
  onDragTicket: (ticket: TicketItem | null) => void;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const formatWhen = (value: string) => {
  const date = parseTicketDate(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-BO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/** Panel lateral de la agenda con los tickets de la sucursal: buscar, filtrar, arrastrar al calendario o abrir. */
export default function TicketsSidePanel({
  branchId,
  refreshKey,
  onClose,
  onOpenTicket,
  onDragTicket,
}: TicketsSidePanelProps) {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setTickets(await AgendaService.listTickets({ limit: 500, branch_id: branchId ?? undefined }));
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const statusOptions = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.status).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
    [tickets],
  );

  const visible = useMemo(() => {
    const query = normalize(search);
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!query) return true;
      const haystack = normalize(
        [t.ticket_code ?? "", t.client_name, t.service_name ?? "", ...(t.service_names ?? [])].join(" "),
      );
      return haystack.includes(query);
    });
  }, [search, status, tickets]);

  const fieldClass =
    "h-8 w-full rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2.5 text-xs text-[var(--ui-text)] outline-none focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";

  return (
    <aside className="flex max-h-[min(80vh,960px)] min-h-0 w-full shrink-0 flex-col border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--ui-border)] px-3 py-2">
        <p className="text-xs font-semibold text-[var(--ui-text)]">
          Tickets <span className="font-normal text-[var(--ui-text-muted)]">· {visible.length}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            title="Actualizar lista"
            aria-label="Actualizar lista"
            className="rounded-md p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Ocultar panel"
            aria-label="Ocultar panel de tickets"
            className="rounded-md p-1 text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-[var(--ui-border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ui-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clienta, código o servicio…"
            aria-label="Buscar tickets"
            className={`${fieldClass} pl-8`}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado" className={fieldClass}>
          <option value="all">Todos los estados</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s] ?? s}
            </option>
          ))}
        </select>
        <p className="text-[11px] leading-snug text-[var(--ui-text-muted)]">
          Arrastra un ticket al calendario para agendarlo, o haz clic para ir a su fecha y editarlo.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {isLoading && tickets.length === 0 ? (
          <p className="text-xs text-[var(--ui-text-muted)]">Cargando tickets…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-[var(--ui-text-muted)]">No hay tickets con ese filtro.</p>
        ) : (
          visible.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TICKET_DRAG_MIME, String(ticket.id));
                e.dataTransfer.effectAllowed = "move";
                onDragTicket(ticket);
              }}
              onDragEnd={() => onDragTicket(null)}
              onClick={() => onOpenTicket(ticket)}
              title="Arrastra al calendario o haz clic para abrir"
              className={`flex w-full cursor-grab items-start rounded-md border border-l-[3px] px-2 py-1.5 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${ticketCardClass(ticket.status)}`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-[12px] font-semibold">{ticket.client_name}</span>
                  <span className="shrink-0 rounded-full bg-white/70 px-1.5 text-[10px] font-medium">
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                </span>
                <span className="block truncate text-[11px] opacity-80">
                  {ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio"}
                </span>
                <span className="block truncate text-[11px] tabular-nums opacity-70">
                  {formatWhen(ticket.start_time)}
                  {ticket.ticket_code ? ` · ${ticket.ticket_code}` : ""}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
