import { useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Maximize2, Minimize2 } from "lucide-react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";

/** Con más tickets que esto, la columna se compacta sola (salvo que el usuario la expanda). */
const AUTO_COMPACT_FROM = 5;
const DENSITY_STORAGE_PREFIX = "queue-density:";

type Density = "auto" | "compact" | "full";

const readDensity = (id: string): Density => {
  try {
    const saved = localStorage.getItem(`${DENSITY_STORAGE_PREFIX}${id}`);
    return saved === "compact" || saved === "full" ? saved : "auto";
  } catch {
    return "auto";
  }
};

export default function DroppableColumn({
  id,
  title,
  tickets,
  isEmptyLabel,
  renderCard,
  highlightTicket,
  dataTour,
}: {
  id: string;
  title: string;
  subtitle?: string;
  tickets: TicketItem[];
  isEmptyLabel: string;
  /** `compact` = tarjetas reducidas (2 líneas) cuando hay muchos trabajos en la columna. */
  renderCard: (ticket: TicketItem, compact: boolean) => ReactNode;
  highlightTicket?: (ticket: TicketItem) => boolean;
  dataTour?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hasTickets = tickets.length > 0;
  const [density, setDensity] = useState<Density>(() => readDensity(id));
  const compact = density === "compact" || (density === "auto" && tickets.length >= AUTO_COMPACT_FROM);

  const toggleDensity = () => {
    const next: Density = compact ? "full" : "compact";
    setDensity(next);
    try {
      localStorage.setItem(`${DENSITY_STORAGE_PREFIX}${id}`, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      data-tour={dataTour}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm"
    >
      {/* Encabezado de la columna */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ui-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-[var(--ui-text)]">{title}</h3>
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--ui-surface-muted)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--ui-text-muted)]">
            {tickets.length}
          </span>
        </div>
        {hasTickets && (
          <button
            type="button"
            onClick={toggleDensity}
            title={compact ? "Ver tarjetas completas" : "Compactar tarjetas para ver más trabajos a la vez"}
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
          >
            {compact ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            {compact ? "Expandir" : "Compactar"}
          </button>
        )}
      </div>

      {/* Zona para soltar */}
      <div
        ref={setNodeRef}
        className={`min-h-0 flex-1 overflow-y-auto p-2 transition-colors duration-150 ${compact ? "space-y-1.5" : "space-y-2"} ${
          isOver ? "bg-[var(--ui-accent-soft)] ring-2 ring-inset ring-[#9F8351]/40" : "bg-[var(--ui-surface-muted)]"
        }`}
      >
        {!hasTickets ? (
          <div className="flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-4 text-center">
            <p className="text-xs font-medium text-[var(--ui-text-muted)]">{isEmptyLabel}</p>
            <p className="text-[11px] text-[var(--ui-text-muted)]">Arrastra un ticket aquí o usa las acciones de la tarjeta.</p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const isNew = highlightTicket?.(ticket);
            return (
              <div key={ticket.id} className={isNew ? "relative rounded-lg ring-2 ring-[#9F8351]/60" : ""}>
                {isNew ? (
                  <span className="absolute -top-2 right-2 z-10 rounded-full bg-[#9F8351] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Nuevo
                  </span>
                ) : null}
                {renderCard(ticket, compact)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
