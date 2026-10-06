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
  if (operarias.length === 0) return null;

  return (
    <div
      style={{
        maxHeight: collapsed ? 0 : "120px",
        opacity: collapsed ? 0 : 1,
        overflow: "hidden",
        transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-1.5">
        {operarias.map((op) => {
          const styles = STATUS_STYLES[op.currentStatus] ?? STATUS_STYLES.free;
          const selected = selectedId === String(op.professionalId);
          return (
            <button
              type="button"
              key={op.professionalId}
              onClick={() => onSelect?.(selected ? "" : String(op.professionalId))}
              aria-pressed={selected}
              title={`${
                op.activeTicket
                  ? `Atendiendo: ${op.activeTicket.client_name} — ${op.activeTicket.ticket_code ?? `#${op.activeTicket.id}`}`
                  : op.professionalName
              } · ${selected ? "Clic para quitar el filtro" : "Clic para ver solo sus tickets"}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-[var(--ui-surface-hover)] ${styles.badge} ${
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
  );
}
