import type { OperariaStatus, OperariaCurrentStatus } from "../control.types";

interface StatusStyle {
  dot: string;
  badge: string;
  label: string;
}

const STATUS_STYLES: Record<OperariaCurrentStatus, StatusStyle> = {
  in_service: {
    dot:   "bg-[#0078d4]",
    badge: "border-[#deecf9] bg-[#eff6fc] text-[#0078d4]",
    label: "En servicio",
  },
  pending: {
    dot:   "bg-[#D83B01]",
    badge: "border-[#f9ddd5] bg-[#fef0eb] text-[#D83B01]",
    label: "En espera",
  },
  confirmed: {
    dot:   "bg-[#D83B01]",
    badge: "border-[#f9ddd5] bg-[#fef0eb] text-[#D83B01]",
    label: "Confirmada",
  },
  completed: {
    dot:   "bg-[#107C10]",
    badge: "border-[#bad80a]/40 bg-[#f1faf1] text-[#107C10]",
    label: "Finalizada",
  },
  cancelled: {
    dot:   "bg-[#a19f9d]",
    badge: "border-[#edebe9] bg-[#f3f2f1] text-[#a19f9d]",
    label: "Cancelada",
  },
  free: {
    dot:   "bg-[#c8c6c4]",
    badge: "border-[#edebe9] bg-white text-[#605e5c]",
    label: "Libre",
  },
};

interface Props {
  operarias: OperariaStatus[];
}

export default function OperariaStatusPanel({ operarias }: Props) {
  if (operarias.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#edebe9] bg-[#faf9f8] px-3 py-1.5">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-[#a19f9d]">
        Operarias
      </span>
      {operarias.map((op) => {
        const styles = STATUS_STYLES[op.currentStatus] ?? STATUS_STYLES.free;
        return (
          <div
            key={op.professionalId}
            title={
              op.activeTicket
                ? `Atendiendo: ${op.activeTicket.client_name} — ${op.activeTicket.ticket_code ?? `#${op.activeTicket.id}`}`
                : op.professionalName
            }
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`} />
            <span className="font-semibold">{op.professionalName}</span>
            <span className="opacity-60">·</span>
            <span>{styles.label}</span>
            {op.ticketsToday.length > 0 && (
              <span className="ml-0.5 opacity-50">({op.ticketsToday.length})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
