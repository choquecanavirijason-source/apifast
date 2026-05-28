import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Calendar, Clock, User, X, ChevronRight, Scissors } from "lucide-react";

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
  pending: "#D83B01",
  waiting: "#D83B01",
  confirmed: "#D83B01",
  in_service: "#0078D4",
  completed: "#107C10",
  cancelled: "#A4262C",
};

const stopDragPointer = (e: React.PointerEvent) => {
  e.stopPropagation();
};

const STATUS_BADGE: Record<string, { bg: string; border: string; color: string }> = {
  pending: { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  waiting: { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  confirmed: { bg: "#FFF4F0", border: "#F4B8A0", color: "#BC4B09" },
  in_service: { bg: "#EFF6FC", border: "#9DC4E6", color: "#005A9E" },
  completed: { bg: "#F1FBF1", border: "#A3D7A4", color: "#107C10" },
  cancelled: { bg: "#FDE7E9", border: "#F1ADBA", color: "#A4262C" },
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
    borderLeft: `4px solid ${STATUS_STRIP[ticket.status] ?? "#D2D0CE"}`,
    touchAction: "none",
  };

  const badge = STATUS_BADGE[ticket.status] ?? { bg: "#F3F2F1", border: "#D2D0CE", color: "#605E5C" };
  const hasQuickChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const serviceList: string[] =
    ticket.service_names?.length
      ? ticket.service_names
      : ticket.service_name
        ? [ticket.service_name]
        : ["Sin servicio"];
  const remaining = showRemaining ? getRemainingLabel(ticket.end_time) : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab touch-none border border-[#c8c6c4] bg-white transition-shadow active:cursor-grabbing ${
        isDragging
          ? "z-0 shadow-none ring-2 ring-dashed ring-[#8a8886]"
          : "shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]"
      }`}
    >
      {isPopupOpen ? (
        <>
          <div className="absolute inset-0 z-[60] bg-[#f3f2f1]/60" />
          <div
            ref={popoverRef}
            onPointerDown={stopDragPointer}
            className="absolute left-1/2 top-2 z-[70] w-[95%] -translate-x-1/2 border border-[#c8c6c4] bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#edebe9] pb-2">
              <div>
                <h4 className="text-sm font-semibold text-[#201f1e]">Ajustar turno</h4>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  Cambios automáticos
                </p>
              </div>
              <button
                type="button"
                onPointerDown={stopDragPointer}
                onClick={() => setIsPopupOpen(false)}
                className="border border-transparent p-1 text-[#605e5c] hover:border-[#c8c6c4] hover:bg-[#f3f2f1]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-[#605e5c]">
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
                  <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-[#605e5c]">
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
                <label className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-[#605e5c]">
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
                    className="flex-1 border border-[#8a8886] bg-[#f3f2f1] py-1.5 text-[10px] font-semibold text-[#323130] hover:bg-white hover:border-[#0078d4] hover:text-[#0078d4]"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {hasQuickChanges ? (
              <div className="mt-3 flex items-center justify-center gap-2 border border-[#9dc4e6] bg-[#eff6fc] py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0078d4]" />
                <span className="text-[10px] font-semibold text-[#005a9e]">
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
              className="mt-0.5 shrink-0 text-[#c8c6c4] opacity-80 group-hover:text-[#0078d4]"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-[#201f1e]">{ticket.client_name}</h3>
              {/* Chips de servicios */}
              <div className="mt-1 flex flex-wrap gap-1">
                {serviceList.map((svc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-0.5 rounded-sm border border-[#9dc4e6] bg-[#eff6fc] px-1.5 py-0.5 text-[10px] font-semibold text-[#005a9e]"
                  >
                    <Scissors size={9} className="shrink-0" />
                    {svc}
                  </span>
                ))}
              </div>
              <span className="mt-0.5 block text-[10px] font-medium text-[#8a8886]">{ticket.branch_name || "Central"}</span>
            </div>
          </div>

          <button
            type="button"
            onPointerDown={stopDragPointer}
            onClick={() => setIsPopupOpen(true)}
            className={`flex shrink-0 items-center gap-0.5 border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              hasQuickChanges
                ? "border-[#f4b8a0] bg-[#fff4f0] text-[#bc4b09]"
                : "border-[#c8c6c4] bg-[#f3f2f1] text-[#323130] hover:bg-white"
            }`}
          >
            Editar <ChevronRight size={10} />
          </button>
        </div>

        <div className="flex items-center justify-between border-y border-[#edebe9] bg-[#faf9f8] px-1 py-1.5">
          <div>
            <span className="text-xs font-semibold text-[#323130]">
              {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
            </span>
            {remaining ? (
              <p className="text-[10px] font-semibold text-[#0078d4]">{remaining}</p>
            ) : (
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#8a8886]">Horario</p>
            )}
          </div>
          <span
            className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
          >
            {STATUS_LABELS[ticket.status] || ticket.status}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1 border border-[#a3d7a4] bg-[#f1fbf1] px-1.5 py-0.5">
            <User size={10} className="text-[#107c10]" />
            <span className="text-[10px] font-semibold text-[#107c10]">
              {professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username || "Sin asignar"}
            </span>
          </div>
          <button
            type="button"
            onPointerDown={stopDragPointer}
            onClick={() => onDelete(ticket)}
            className="border border-transparent p-1 text-[#8a8886] hover:border-[#f1adba] hover:bg-[#fde7e9] hover:text-[#a4262c]"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {ticket.ticket_code ? (
          <p className="mt-1 font-mono text-[10px] text-[#8a8886]">{ticket.ticket_code}</p>
        ) : null}
      </div>

      <div className="border-t border-[#edebe9] px-2.5 pb-2.5 pt-1" onPointerDown={stopDragPointer}>
        {actions}
      </div>
    </div>
  );
}
