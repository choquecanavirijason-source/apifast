import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Calendar, Clock, User, X, ChevronRight } from "lucide-react";

import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime, STATUS_LABELS } from "../control.constants";
import { BC_FIELD } from "../control.bc365.styles";

const getDateInputValue = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getTimeInputValue = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const h = String(parsed.getHours()).padStart(2, "0");
  const m = String(parsed.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  if (!time || !Number.isFinite(minutesToAdd)) return time;
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const total = (rawHour || 0) * 60 + (rawMinute || 0) + minutesToAdd;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minute}`;
};

const STATUS_STRIP: Record<string, string> = {
  pending:    "#f59e0b",
  waiting:    "#f59e0b",
  confirmed:  "#f59e0b",
  in_service: "#3b82f6",
  completed:  "#10b981",
  cancelled:  "#ef4444",
};

const STATUS_BADGE: Record<string, { bg: string; border: string; color: string }> = {
  pending:    { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  waiting:    { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  confirmed:  { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
  in_service: { bg: "#eff6ff", border: "#93c5fd", color: "#2563eb" },
  completed:  { bg: "#f0fdf4", border: "#6ee7b7", color: "#059669" },
  cancelled:  { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626" },
};

const stopDragPointer = (e: React.PointerEvent) => e.stopPropagation();

export default function DraggableTicketCard({
  ticket,
  actions,
  showRemaining,
  getRemainingLabel,
  onDelete,
  professionals,
  onSaveEdits,
  isSavingEdit,
}: {
  ticket: TicketItem;
  actions: ReactNode;
  showRemaining: boolean;
  statusColors: Record<string, string>;
  getRemainingLabel: (endTime: string) => string;
  onDelete: (ticket: TicketItem) => void;
  professionals: ProfessionalForSelect[];
  onSaveEdits: (
    ticket: TicketItem,
    payload: { date: string; time: string; professionalId: string; isIa: boolean }
  ) => void;
  isSavingEdit: boolean;
}) {
  const [quickDate, setQuickDate] = useState(getDateInputValue(ticket.start_time));
  const [quickProfessionalId, setQuickProfessionalId] = useState(
    ticket.professional_id ? String(ticket.professional_id) : ""
  );
  const [quickTime, setQuickTime] = useState(getTimeInputValue(ticket.start_time));
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const quickSaveTimerRef = useRef<number | null>(null);
  const lastAutoSubmitKeyRef = useRef<string>("");
  const isSavingEditRef = useRef(isSavingEdit);

  useEffect(() => {
    isSavingEditRef.current = isSavingEdit;
  }, [isSavingEdit]);

  useEffect(() => {
    setQuickDate(getDateInputValue(ticket.start_time));
    setQuickProfessionalId(ticket.professional_id ? String(ticket.professional_id) : "");
    setQuickTime(getTimeInputValue(ticket.start_time));
  }, [ticket.id, ticket.start_time, ticket.professional_id]);

  useEffect(() => {
    if (quickSaveTimerRef.current != null) window.clearTimeout(quickSaveTimerRef.current);

    const hasChanges =
      quickDate !== getDateInputValue(ticket.start_time) ||
      quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
      quickTime !== getTimeInputValue(ticket.start_time);

    if (!hasChanges || isSavingEditRef.current) return;

    const submitKey = `${quickDate}|${quickTime}|${quickProfessionalId}`;
    if (submitKey === lastAutoSubmitKeyRef.current) return;

    quickSaveTimerRef.current = window.setTimeout(() => {
      lastAutoSubmitKeyRef.current = submitKey;
      onSaveEdits(ticket, { date: quickDate, time: quickTime, professionalId: quickProfessionalId, isIa: Boolean(ticket.is_ia) });
    }, 800);

    return () => {
      if (quickSaveTimerRef.current != null) window.clearTimeout(quickSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, quickProfessionalId, quickTime]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setIsPopupOpen(false);
    };
    if (isPopupOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPopupOpen]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket, column: ticket.status },
    disabled: isPopupOpen,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `3px solid ${STATUS_STRIP[ticket.status] ?? "#cbd5e1"}`,
    touchAction: "none",
  };

  const badge = STATUS_BADGE[ticket.status] ?? { bg: "#f8fafc", border: "#cbd5e1", color: "#64748b" };
  const hasQuickChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const services =
    ticket.service_names?.length ? ticket.service_names.join(", ") : ticket.service_name ?? "Sin servicio";
  const remaining = showRemaining ? getRemainingLabel(ticket.end_time) : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab touch-none rounded-lg border border-slate-200 bg-white transition-shadow active:cursor-grabbing ${
        isDragging
          ? "z-0 shadow-none ring-2 ring-dashed ring-slate-300"
          : "shadow-sm hover:shadow-md"
      }`}
    >
      {isPopupOpen ? (
        <>
          <div className="absolute inset-0 z-60 rounded-lg bg-slate-100/70" />
          <div
            ref={popoverRef}
            onPointerDown={stopDragPointer}
            className="absolute left-1/2 top-2 z-70 w-[95%] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Ajustar turno</h4>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Cambios automáticos
                </p>
              </div>
              <button
                type="button"
                onPointerDown={stopDragPointer}
                onClick={() => setIsPopupOpen(false)}
                className="rounded-lg border border-transparent p-1 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                    <Calendar size={11} /> Fecha
                  </label>
                  <input
                    type="date"
                    value={quickDate}
                    onPointerDown={stopDragPointer}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className={BC_FIELD}
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                    <Clock size={11} /> Hora
                  </label>
                  <input
                    type="time"
                    value={quickTime}
                    onPointerDown={stopDragPointer}
                    onChange={(e) => setQuickTime(e.target.value)}
                    className={BC_FIELD}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                  <User size={11} /> Profesional
                </label>
                <select
                  value={quickProfessionalId}
                  onPointerDown={stopDragPointer}
                  onChange={(e) => setQuickProfessionalId(e.target.value)}
                  className={`${BC_FIELD} cursor-pointer`}
                >
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1">
                {["Ahora", "+15 min", "+30 min"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onPointerDown={stopDragPointer}
                    onClick={() => {
                      if (label === "Ahora") setQuickTime(getTimeInputValue(new Date().toISOString()));
                      else setQuickTime((p) => addMinutesToTime(p, label === "+15 min" ? 15 : 30));
                    }}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[10px] font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {hasQuickChanges ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                <span className="text-[10px] font-semibold text-blue-600">
                  {isSavingEdit ? "Sincronizando…" : "Cambios pendientes"}
                </span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="p-2.5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <GripVertical
              size={14}
              className="mt-0.5 shrink-0 text-slate-300 opacity-80 group-hover:text-blue-400"
              aria-hidden
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900">{ticket.client_name}</h3>
              <p className="truncate text-[10px] text-slate-500">{services}</p>
              <span className="text-[10px] font-medium text-slate-400">{ticket.branch_name || "Central"}</span>
            </div>
          </div>

          <button
            type="button"
            onPointerDown={stopDragPointer}
            onClick={() => setIsPopupOpen(true)}
            className={`flex shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors ${
              hasQuickChanges
                ? "border-amber-200 bg-amber-50 text-amber-600"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-300"
            }`}
          >
            Editar <ChevronRight size={10} />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
          <div>
            <span className="text-xs font-semibold text-slate-700">
              {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
            </span>
            {remaining ? (
              <p className="text-[10px] font-semibold text-blue-500">{remaining}</p>
            ) : (
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Horario</p>
            )}
          </div>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
            style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
          >
            {STATUS_LABELS[ticket.status] || ticket.status}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
            <User size={10} className="text-emerald-600" />
            <span className="text-[10px] font-semibold text-emerald-700">
              {professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username || "Sin asignar"}
            </span>
          </div>
          <button
            type="button"
            onPointerDown={stopDragPointer}
            onClick={() => onDelete(ticket)}
            className="rounded-lg border border-transparent p-1 text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {ticket.ticket_code ? (
          <p className="mt-1 font-mono text-[10px] text-slate-400">{ticket.ticket_code}</p>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-1" onPointerDown={stopDragPointer}>
        {actions}
      </div>
    </div>
  );
}
