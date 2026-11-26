import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { OperariaStatus } from "../control.types";

type Props = {
  /** "" = todas, "none" = sin operaria, o el id (en texto) de una operaria. */
  value: string;
  onChange: (value: string) => void;
  /** Estado en vivo de cada operaria (derivado de los tickets del día). */
  operarias: OperariaStatus[];
};

type Kind = "in_service" | "waiting" | "free";

const KIND_STYLE: Record<Kind, { label: string; badge: string; dot: string }> = {
  in_service: { label: "En servicio", badge: "bg-[#fde7e9] text-[#d13438]", dot: "bg-[#d13438]" },
  waiting: { label: "En espera", badge: "bg-[#fff4ce] text-[#8a6a1f]", dot: "bg-[#c19c00]" },
  free: { label: "Libre", badge: "bg-[#dff6dd] text-[#107c10]", dot: "bg-[#107c10]" },
};

const kindOf = (op: OperariaStatus): Kind =>
  op.currentStatus === "in_service" ? "in_service" : op.currentStatus === "pending" || op.currentStatus === "confirmed" ? "waiting" : "free";

const countByStatus = (op: OperariaStatus, kind: "in_service" | "waiting") =>
  op.ticketsToday.filter((t) => (kind === "in_service" ? t.status === "in_service" : t.status === "pending" || t.status === "confirmed")).length;

/**
 * Filtro por operaria del tablero. A diferencia del <select> nativo, cada opción muestra si la operaria
 * está En servicio, En espera o Libre, con los mismos colores que el selector de operaria del POS.
 */
export default function OperariaFilterSelect({ value, onChange, operarias }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const selected = operarias.find((o) => String(o.professionalId) === value) ?? null;
  const selectedKind = selected ? kindOf(selected) : null;
  const label = value === "" ? "Todas las operarias" : value === "none" ? "Sin operaria" : selected?.professionalName ?? "Operaria";

  const pick = (next: string) => { onChange(next); setOpen(false); };

  const counts = operarias.reduce(
    (acc, op) => { acc[kindOf(op)] += 1; return acc; },
    { in_service: 0, waiting: 0, free: 0 } as Record<Kind, number>,
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por operaria"
        className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs outline-none focus:ring-2 focus:ring-brand-secondary/20 ${
          value
            ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] font-medium text-[var(--ui-accent)]"
            : "border-[var(--ui-border-strong)] bg-[var(--ui-input)] text-[var(--ui-text)]"
        }`}
      >
        {selectedKind && <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[selectedKind].dot}`} />}
        <span className={`max-w-[10rem] truncate ${selected ? "capitalize" : ""}`}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div role="listbox" className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-white shadow-lg">
          {/* Resumen rápido */}
          <div className="flex items-center gap-1.5 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2">
            {(["free", "waiting", "in_service"] as Kind[]).map((k) => (
              <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_STYLE[k].badge}`}>
                {counts[k]} {KIND_STYLE[k].label.toLowerCase()}
              </span>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {([["", "Todas las operarias"], ["none", "Sin operaria"]] as const).map(([val, text]) => (
              <button
                key={val || "all"}
                type="button"
                role="option"
                aria-selected={value === val}
                onClick={() => pick(val)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[var(--ui-surface-hover)] ${value === val ? "bg-[#ecfdf5]" : ""}`}
              >
                <span className={value === val ? "font-semibold text-[#094732]" : "text-[var(--ui-text)]"}>{text}</span>
                {value === val && <Check className="h-4 w-4 text-[#094732]" />}
              </button>
            ))}

            <div className="my-1 border-t border-[var(--ui-border)]" />

            {operarias.map((op) => {
              const kind = kindOf(op);
              const st = KIND_STYLE[kind];
              const active = value === String(op.professionalId);
              const inService = countByStatus(op, "in_service");
              const waiting = countByStatus(op, "waiting");
              return (
                <button
                  key={op.professionalId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(String(op.professionalId))}
                  title={op.activeTicket ? `Atendiendo: ${op.activeTicket.client_name} — ${op.activeTicket.ticket_code ?? `#${op.activeTicket.id}`}` : undefined}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--ui-surface-hover)] ${active ? "bg-[#ecfdf5]" : ""}`}
                >
                  <span className={`truncate capitalize ${active ? "font-semibold text-[#094732]" : "text-[var(--ui-text)]"}`}>{op.professionalName}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                      {kind === "in_service" && inService > 1 && <span className="opacity-70">· {inService}</span>}
                      {kind === "waiting" && waiting > 1 && <span className="opacity-70">· {waiting}</span>}
                    </span>
                    {kind === "in_service" && waiting > 0 && (
                      <span className="rounded-full bg-[#fff4ce] px-1.5 py-0.5 text-[10px] font-bold text-[#8a6a1f]" title="Tickets esperando con esta operaria">
                        +{waiting} en espera
                      </span>
                    )}
                    {active && <Check className="h-4 w-4 text-[#094732]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
