import { useEffect, useRef, useState, type ReactNode } from "react";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime, STATUS_LABELS } from "../control.constants";

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

// Fluent UI / Business Central palette
const STATUS_STRIP: Record<string, string> = {
  pending:    "#D83B01",
  waiting:    "#D83B01",
  confirmed:  "#D83B01",
  in_service: "#0078D4",
  completed:  "#107C10",
  cancelled:  "#A4262C",
};

const STATUS_BADGE: Record<string, { bg: string; border: string; color: string }> = {
  pending:    { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  waiting:    { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  confirmed:  { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  in_service: { bg: "#EFF6FC", border: "#9DC4E6", color: "#005A9E" },
  completed:  { bg: "#F1FBF1", border: "#A3D7A4", color: "#107C10" },
  cancelled:  { bg: "#FDE7E9", border: "#F1ADBA", color: "#A4262C" },
};

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
  onSaveEdits: (ticket: TicketItem, payload: { date: string; time: string; professionalId: string; isIa: boolean }) => void;
  isSavingEdit: boolean;
}) {
  const [quickDate, setQuickDate] = useState(getDateInputValue(ticket.start_time));
  const [quickProfessionalId, setQuickProfessionalId] = useState(ticket.professional_id ? String(ticket.professional_id) : "");
  const [quickTime, setQuickTime] = useState(getTimeInputValue(ticket.start_time));
  const quickSaveTimerRef = useRef<number | null>(null);
  const lastAutoSubmitKeyRef = useRef<string>("");
  const wasSavingRef = useRef(false);
  const [quickError, setQuickError] = useState("");
  const isIa = Boolean(ticket.is_ia);

  useEffect(() => {
    setQuickDate(getDateInputValue(ticket.start_time));
    setQuickProfessionalId(ticket.professional_id ? String(ticket.professional_id) : "");
    setQuickTime(getTimeInputValue(ticket.start_time));
    setQuickError("");
  }, [ticket.id, ticket.start_time, ticket.professional_id, ticket.is_ia]);

  useEffect(() => {
    if (quickSaveTimerRef.current != null) {
      window.clearTimeout(quickSaveTimerRef.current);
      quickSaveTimerRef.current = null;
    }

    const currentDate = getDateInputValue(ticket.start_time);
    const currentProfessionalId = ticket.professional_id ? String(ticket.professional_id) : "";
    const currentTime = getTimeInputValue(ticket.start_time);
    const hasChanges = quickDate !== currentDate || quickProfessionalId !== currentProfessionalId || quickTime !== currentTime;
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(quickDate);
    const hasValidTime = /^\d{2}:\d{2}$/.test(quickTime);
    const nextSubmitKey = `${ticket.id}|${quickDate}|${quickProfessionalId}|${quickTime}`;

    if (!hasValidDate) { setQuickError("Fecha invalida. Usa formato YYYY-MM-DD."); return; }
    if (!hasValidTime) { setQuickError("Hora invalida. Usa formato HH:mm."); return; }
    if (quickError) setQuickError("");
    if (!hasChanges) { lastAutoSubmitKeyRef.current = ""; return; }
    if (lastAutoSubmitKeyRef.current === nextSubmitKey || isSavingEdit) return;

    quickSaveTimerRef.current = window.setTimeout(() => {
      lastAutoSubmitKeyRef.current = nextSubmitKey;
      onSaveEdits(ticket, { date: quickDate, time: quickTime, professionalId: quickProfessionalId, isIa });
    }, 450);

    return () => {
      if (quickSaveTimerRef.current != null) {
        window.clearTimeout(quickSaveTimerRef.current);
        quickSaveTimerRef.current = null;
      }
    };
  }, [isIa, isSavingEdit, onSaveEdits, quickDate, quickProfessionalId, quickTime, ticket.id, ticket.professional_id, ticket.start_time, quickError]);

  useEffect(() => {
    const currentDate = getDateInputValue(ticket.start_time);
    const currentProfessionalId = ticket.professional_id ? String(ticket.professional_id) : "";
    const currentTime = getTimeInputValue(ticket.start_time);
    const hasPendingMismatch = quickDate !== currentDate || quickProfessionalId !== currentProfessionalId || quickTime !== currentTime;
    if (wasSavingRef.current && !isSavingEdit && hasPendingMismatch && lastAutoSubmitKeyRef.current) {
      setQuickError("No se pudo guardar automaticamente. Revisa hora/operaria e intenta de nuevo.");
    }
    wasSavingRef.current = isSavingEdit;
  }, [isSavingEdit, quickDate, quickProfessionalId, quickTime, ticket.professional_id, ticket.start_time]);

  const assignedProfessional =
    professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username ??
    ticket.professional_name ??
    "Sin operaria";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket },
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.5 : 1,
    borderLeft: `3px solid ${STATUS_STRIP[ticket.status] ?? "#D2D0CE"}`,
  };

  const badge = STATUS_BADGE[ticket.status] ?? { bg: "#F3F2F1", border: "#D2D0CE", color: "#605E5C" };

  const hasQuickChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const inputClass =
    "h-7 w-full border border-[#8a8886] bg-white px-1.5 text-[11px] text-[#323130] outline-none transition focus:border-[#0078d4]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-[#d2d0ce] bg-white transition-shadow ${
        isDragging ? "shadow-[0_4px_12px_rgba(0,0,0,0.18)]" : "shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none p-0.5 text-[#a19f9d] transition hover:bg-[#f3f2f1] hover:text-[#605e5c] active:cursor-grabbing"
            aria-label="Arrastrar ticket"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-[#323130]">{ticket.client_name}</p>
            <p className="text-[11px] text-[#8a8886]">{ticket.branch_name ?? "Sin sucursal"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showRemaining ? (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#EFF6FC", color: "#005A9E" }}>
              {getRemainingLabel(ticket.end_time)}
            </span>
          ) : null}
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold capitalize"
            style={{ backgroundColor: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}
          >
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(ticket); }}
            className="flex h-6 w-6 items-center justify-center text-[#a19f9d] transition hover:bg-[#fde7e9] hover:text-[#a4262c]"
            aria-label="Eliminar ticket"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info rows */}
      <div className="border-t border-[#edebe9] px-3 py-1.5 text-[11px] text-[#605e5c]">
        <p className="truncate">{(ticket.service_names ?? [ticket.service_name ?? "—"]).filter(Boolean).join(" · ")}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span>{formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}</span>
          <span
            className="px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ backgroundColor: "#F1FBF1", border: "1px solid #A3D7A4", color: "#107C10" }}
          >
            {assignedProfessional}
          </span>
        </div>
      </div>

      {/* Quick edit */}
      <div className="mx-2 mb-2 mt-1.5 border border-[#edebe9] bg-[#f3f2f1] p-2">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8a8886]">Edición rápida</p>
        <div className="grid gap-1 sm:grid-cols-[110px_1fr_88px]">
          <input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className={inputClass} />
          <select
            value={quickProfessionalId}
            onChange={(e) => setQuickProfessionalId(e.target.value)}
            className={inputClass}
          >
            <option value="">Sin operaria</option>
            {professionals.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.username}</option>
            ))}
          </select>
          <input type="time" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} className={inputClass} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {(["Ahora", "+15 min", "+30 min"] as const).map((label) => (
            <button
              key={label}
              type="button"
              disabled={isSavingEdit}
              onClick={() => {
                if (label === "Ahora") setQuickTime(getTimeInputValue(new Date().toISOString()));
                else if (label === "+15 min") setQuickTime((p) => addMinutesToTime(p, 15));
                else setQuickTime((p) => addMinutesToTime(p, 30));
              }}
              className="border border-[#d2d0ce] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#605e5c] hover:bg-[#faf9f8] disabled:opacity-60"
            >
              {label}
            </button>
          ))}
          {hasQuickChanges ? (
            <span className="text-[10px] font-semibold" style={{ color: "#0078D4" }}>
              {isSavingEdit ? "Guardando..." : "Cambios pendientes"}
            </span>
          ) : null}
        </div>
        {quickError ? (
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "#A4262C" }}>{quickError}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#edebe9] px-3 py-2">
        {actions}
      </div>
    </div>
  );
}
