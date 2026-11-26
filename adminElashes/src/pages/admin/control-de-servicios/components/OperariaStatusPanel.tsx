import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OperariaStatus, OperariaCurrentStatus } from "../control.types";

interface StatusStyle {
  dot: string;
  badge: string;
  label: string;
}

const STATUS_STYLES: Record<OperariaCurrentStatus, StatusStyle> = {
  in_service: {
    dot:   "bg-[#201f1e]",
    badge: "border-[#201f1e] bg-white text-[var(--ui-text)]",
    label: "En servicio",
  },
  pending: {
    dot:   "bg-[#605e5c]",
    badge: "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)]",
    label: "En espera",
  },
  confirmed: {
    dot:   "bg-[#605e5c]",
    badge: "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)]",
    label: "Confirmada",
  },
  completed: {
    dot:   "bg-[#8a8886]",
    badge: "border-[var(--ui-border-strong)] bg-white text-[var(--ui-text-muted)]",
    label: "Finalizada",
  },
  cancelled: {
    dot:   "bg-[#a19f9d]",
    badge: "border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-text-muted)]",
    label: "Cancelada",
  },
  free: {
    dot:   "bg-[#c8c6c4]",
    badge: "border-[var(--ui-border)] bg-white text-[var(--ui-text-muted)]",
    label: "Libre",
  },
};

interface Props {
  operarias: OperariaStatus[];
  collapsed: boolean;
  /** Operaria por la que se está filtrando el tablero (id en texto), o "" si ninguna. */
  selectedId?: string;
  /** Clic en una operaria: filtra el tablero por ella (otro clic quita el filtro). */
  onSelect?: (professionalId: string) => void;
}

export default function OperariaStatusPanel({ operarias, collapsed, selectedId = "", onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Una sola fila que se desliza: con 20 operarias no crece en alto ni tapa el tablero.
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);

    // La rueda del mouse desliza la fila (solo si hay algo que deslizar).
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("scroll", updateArrows);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [updateArrows, operarias.length, collapsed]);

  // Al elegir una operaria (desde aquí o desde el filtro), se acerca a la vista.
  useEffect(() => {
    if (!selectedId) return;
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-op-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedId]);

  const slide = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  if (operarias.length === 0) return null;

  const counts = operarias.reduce(
    (acc, op) => {
      if (op.currentStatus === "in_service") acc.busy += 1;
      else if (op.currentStatus === "pending" || op.currentStatus === "confirmed") acc.waiting += 1;
      else acc.free += 1;
      return acc;
    },
    { free: 0, waiting: 0, busy: 0 },
  );

  return (
    <div
      style={{
        maxHeight: collapsed ? 0 : "120px",
        opacity: collapsed ? 0 : 1,
        overflow: "hidden",
        transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
      }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5">
        {/* Resumen fijo: siempre visible aunque la fila esté deslizada */}
        <span className="hidden shrink-0 text-[11px] font-semibold text-[var(--ui-text-muted)] md:inline">
          <span className="text-[#107c10]">{counts.free} libres</span>
          {counts.waiting > 0 && <> · <span className="text-[#8a6a1f]">{counts.waiting} en espera</span></>}
          {" · "}<span className="text-[#d13438]">{counts.busy} en servicio</span>
        </span>

        <div className="relative min-w-0 flex-1">
          {canLeft && (
            <button
              type="button"
              onClick={() => slide(-1)}
              aria-label="Ver operarias anteriores"
              className="absolute left-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text)] shadow transition hover:bg-[var(--ui-surface-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {canRight && (
            <button
              type="button"
              onClick={() => slide(1)}
              aria-label="Ver más operarias"
              className="absolute right-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--ui-border-strong)] bg-white text-[var(--ui-text)] shadow transition hover:bg-[var(--ui-surface-hover)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {/* Degradado en los bordes: indica que hay más para deslizar */}
          {canLeft && <span className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-[var(--ui-surface-muted)] to-transparent" />}
          {canRight && <span className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-[var(--ui-surface-muted)] to-transparent" />}

          <div
            ref={scrollerRef}
            className={`flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${canLeft ? "pl-7" : ""} ${canRight ? "pr-7" : ""}`}
          >
            {operarias.map((op) => {
              const styles = STATUS_STYLES[op.currentStatus] ?? STATUS_STYLES.free;
              const selected = selectedId === String(op.professionalId);
              return (
                <button
                  type="button"
                  key={op.professionalId}
                  data-op-id={op.professionalId}
                  onClick={() => onSelect?.(selected ? "" : String(op.professionalId))}
                  aria-pressed={selected}
                  title={`${
                    op.activeTicket
                      ? `Atendiendo: ${op.activeTicket.client_name} — ${op.activeTicket.ticket_code ?? `#${op.activeTicket.id}`}`
                      : op.professionalName
                  } · ${selected ? "Clic para quitar el filtro" : "Clic para ver solo sus tickets"}`}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-[var(--ui-surface-hover)] ${styles.badge} ${
                    selected ? "!border-[var(--ui-accent)] !bg-[var(--ui-accent-soft)] !text-[var(--ui-accent)] ring-1 ring-[var(--ui-accent)]/30" : ""
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
                  <span className="font-semibold">{op.professionalName}</span>
                  <span className="opacity-60">·</span>
                  <span>{styles.label}</span>
                  {op.ticketsToday.length > 0 && (
                    <span className="ml-0.5 opacity-50">({op.ticketsToday.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
