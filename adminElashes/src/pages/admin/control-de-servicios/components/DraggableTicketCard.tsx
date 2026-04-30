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

export default function DraggableTicketCard({
  ticket,
  actions,
  showRemaining,
  statusColors,
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

    if (!hasValidDate) {
      setQuickError("Fecha invalida. Usa formato YYYY-MM-DD.");
      return;
    }
    if (!hasValidTime) {
      setQuickError("Hora invalida. Usa formato HH:mm.");
      return;
    }

    if (quickError) {
      setQuickError("");
    }

    if (!hasChanges) {
      // Si los datos del ticket ya reflejan los valores rapidos, reiniciar control anti-bucle.
      lastAutoSubmitKeyRef.current = "";
      return;
    }

    // Evita reintentos infinitos del mismo payload cuando hubo error en backend.
    if (lastAutoSubmitKeyRef.current === nextSubmitKey || isSavingEdit) return;

    quickSaveTimerRef.current = window.setTimeout(() => {
      lastAutoSubmitKeyRef.current = nextSubmitKey;
      onSaveEdits(ticket, {
        date: quickDate,
        time: quickTime,
        professionalId: quickProfessionalId,
        isIa,
      });
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

    // Detecta final de intento de guardado auto para mostrar error si no se sincronizo.
    if (wasSavingRef.current && !isSavingEdit && hasPendingMismatch && lastAutoSubmitKeyRef.current) {
      setQuickError("No se pudo guardar automaticamente. Revisa hora/operaria e intenta de nuevo.");
    }
    wasSavingRef.current = isSavingEdit;
  }, [isSavingEdit, quickDate, quickProfessionalId, quickTime, ticket.professional_id, ticket.start_time]);

  const assignedProfessional =
    professionals.find((professional) => String(professional.id) === String(ticket.professional_id))?.username ??
    ticket.professional_name ??
    "Sin operaria";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;
  const hasQuickChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-[#d2d0ce] bg-white p-3 transition-shadow ${
        isDragging ? "shadow-md ring-1 ring-[#8a8886]" : "shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex cursor-grab touch-none shrink-0 items-center justify-center rounded-sm border border-transparent p-1 text-[#8a8886] transition hover:border-[#edebe9] hover:bg-[#f3f2f1] hover:text-[#323130] active:cursor-grabbing"
            aria-label="Arrastrar ticket"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#323130]">{ticket.client_name}</p>
            <p className="text-xs text-[#605e5c]">{ticket.branch_name ?? "Sin sucursal"}</p>
            {showRemaining ? (
              <p className="mt-1 text-xs font-semibold text-[#107c10]">{getRemainingLabel(ticket.end_time)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`border px-2 py-0.5 text-[11px] font-semibold capitalize ${
              statusColors[ticket.status] || "bg-slate-100 text-slate-600"
            }`}
          >
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(ticket);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-[#8a8886] transition hover:bg-[#fde7e9] hover:text-[#a4262c]"
            aria-label="Eliminar ticket"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs text-[#605e5c]">
        <p>Servicios: {(ticket.service_names ?? [ticket.service_name ?? "-"]).filter(Boolean).join(" · ")}</p>
        <p>
          Hora: {formatTime(ticket.start_time)} - {formatTime(ticket.end_time)}
        </p>
        <div className="pt-0.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a8886]">Operaria</p>
          <span className="inline-flex items-center border border-[#bad80a] bg-[#f8fbe8] px-2 py-0.5 text-xs font-semibold text-[#0b6a0b]">
            {assignedProfessional}
          </span>
        </div>
      </div>

      <div className="mt-2 border border-[#edebe9] bg-[#f3f2f1] p-2">
        <div className="mb-1.5" />
        <div className="grid gap-1.5 sm:grid-cols-[120px_1fr_96px]">
          <input
            type="date"
            value={quickDate}
            onChange={(event) => setQuickDate(event.target.value)}
            className="h-7 w-full rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px] text-[#323130] outline-none transition focus:border-[#0078d4]"
          />
          <select
            value={quickProfessionalId}
            onChange={(event) => setQuickProfessionalId(event.target.value)}
            className="h-7 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-[11px] text-[#323130] outline-none transition focus:border-[#0078d4]"
          >
            <option value="">Sin operaria</option>
            {professionals.map((professional) => (
              <option key={professional.id} value={String(professional.id)}>
                {professional.username}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={quickTime}
            onChange={(event) => setQuickTime(event.target.value)}
            className="h-7 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-[11px] text-[#323130] outline-none transition focus:border-[#0078d4]"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={() => setQuickTime(getTimeInputValue(new Date().toISOString()))}
            className="rounded-sm border border-[#d2d0ce] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#605e5c] hover:bg-[#faf9f8] disabled:opacity-60"
          >
            Ahora
          </button>
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={() => setQuickTime((prev) => addMinutesToTime(prev, 15))}
            className="rounded-sm border border-[#d2d0ce] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#605e5c] hover:bg-[#faf9f8] disabled:opacity-60"
          >
            +15 min
          </button>
          <button
            type="button"
            disabled={isSavingEdit}
            onClick={() => setQuickTime((prev) => addMinutesToTime(prev, 30))}
            className="rounded-sm border border-[#d2d0ce] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#605e5c] hover:bg-[#faf9f8] disabled:opacity-60"
          >
            +30 min
          </button>
          {hasQuickChanges ? <span className="text-[10px] font-semibold text-[#0078d4]">Cambios pendientes</span> : null}
        </div>
        {quickError ? <p className="mt-1 text-[10px] font-semibold text-[#a4262c]">{quickError}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions}
      </div>
    </div>
  );
}
