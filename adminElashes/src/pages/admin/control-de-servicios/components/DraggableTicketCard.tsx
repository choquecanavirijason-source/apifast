import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar, ChevronDown, ChevronRight, ChevronUp,
  Clock, GripVertical, Scissors, Trash2, User, X,
} from "lucide-react";

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
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};

const STATUS_STRIP: Record<string, string> = {
  pending: "#D83B01", waiting: "#D83B01", confirmed: "#D83B01",
  in_service: "#0078D4", completed: "#107C10", cancelled: "#A4262C",
};

const stopDragPointer = (e: React.PointerEvent) => e.stopPropagation();

export default function DraggableTicketCard({
  ticket, actions, showRemaining, getRemainingLabel,
  onDelete, professionals, onSaveEdits, isSavingEdit,
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const quickSaveTimerRef = useRef<number | null>(null);
  const lastAutoSubmitKeyRef = useRef<string>("");
  const isSavingEditRef = useRef(isSavingEdit);

  useEffect(() => { isSavingEditRef.current = isSavingEdit; }, [isSavingEdit]);

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
    return () => { if (quickSaveTimerRef.current != null) window.clearTimeout(quickSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, quickProfessionalId, quickTime]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) setIsEditOpen(false);
    };
    if (isEditOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditOpen]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket, column: ticket.status },
    disabled: isEditOpen || isDetailOpen,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.4 : 1,
    borderLeft: `4px solid ${STATUS_STRIP[ticket.status] ?? "#D2D0CE"}`,
    touchAction: "none",
  };

  const hasQuickChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const primaryService =
    ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio";
  const extraServices = (ticket.service_names?.length ?? 0) > 1
    ? ticket.service_names!.slice(1)
    : [];
  const remaining = showRemaining ? getRemainingLabel(ticket.end_time) : "";
  const proName = professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username
    ?? ticket.professional_name
    ?? "Sin asignar";

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
      {/* ── Panel de edición rápida ──────────────────────────────────────────── */}
      {isEditOpen ? (
        <>
          <div className="absolute inset-0 z-[60] bg-[#f3f2f1]/60" />
          <div
            ref={editRef}
            onPointerDown={stopDragPointer}
            className="absolute left-1/2 top-2 z-[70] w-[95%] -translate-x-1/2 overflow-hidden rounded-sm border border-[#c8c6c4] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
          >
            <div className="h-0.5 bg-[#0078d4]" />
            <div className="flex items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
              <div>
                <h4 className="text-sm font-semibold text-[#323130]">Ajustar turno</h4>
                <p className="text-[11px] text-[#605e5c]">Cambios automáticos</p>
              </div>
              <button type="button" onPointerDown={stopDragPointer} onClick={() => setIsEditOpen(false)}
                className="rounded-sm p-1 text-[#605e5c] hover:bg-[#edebe9]">
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    <Calendar size={10} /> Fecha
                  </label>
                  <input type="date" value={quickDate} onPointerDown={stopDragPointer}
                    onChange={(e) => setQuickDate(e.target.value)} className={BC_FIELD} />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    <Clock size={10} /> Hora
                  </label>
                  <input type="time" value={quickTime} onPointerDown={stopDragPointer}
                    onChange={(e) => setQuickTime(e.target.value)} className={BC_FIELD} />
                </div>
              </div>
              <div className="flex gap-1.5">
                {["Ahora", "+15 min", "+30 min"].map((label) => (
                  <button key={label} type="button" onPointerDown={stopDragPointer}
                    onClick={() => {
                      if (label === "Ahora") setQuickTime(getTimeInputValue(new Date().toISOString()));
                      else setQuickTime((p) => addMinutesToTime(p, label === "+15 min" ? 15 : 30));
                    }}
                    className="flex-1 rounded-sm border border-[#8a8886] bg-[#f3f2f1] py-1.5 text-[11px] font-semibold text-[#323130] hover:border-[#0078d4] hover:text-[#0078d4]">
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  <User size={10} /> Operaria
                </label>
                <select value={quickProfessionalId} onPointerDown={stopDragPointer}
                  onChange={(e) => setQuickProfessionalId(e.target.value)} className={`${BC_FIELD} cursor-pointer`}>
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.username}</option>
                  ))}
                </select>
              </div>
              {hasQuickChanges && (
                <div className="flex items-center gap-2 border border-[#9dc4e6] bg-[#eff6fc] px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0078d4]" />
                  <span className="text-[11px] font-semibold text-[#005a9e]">
                    {isSavingEdit ? "Sincronizando…" : "Cambios pendientes"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* ── Cuerpo mínimo ────────────────────────────────────────────────────── */}
      <div className="p-2">
        {/* Fila superior: drag + nombre + botón editar */}
        <div className="flex items-center gap-1.5">
          <GripVertical size={13} className="shrink-0 text-[#c8c6c4] group-hover:text-[#0078d4]" aria-hidden />
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[#201f1e]">
            {ticket.client_name}
          </h3>
          <button type="button" onPointerDown={stopDragPointer} onClick={() => setIsEditOpen(true)}
            className={`shrink-0 flex items-center gap-0.5 border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              hasQuickChanges ? "border-[#f4b8a0] bg-[#fff4f0] text-[#bc4b09]" : "border-[#c8c6c4] bg-[#f3f2f1] text-[#323130] hover:bg-white"
            }`}>
            Editar <ChevronRight size={10} />
          </button>
        </div>

        {/* Servicio principal */}
        <div className="mt-1 flex items-center gap-1">
          <Scissors size={9} className="shrink-0 text-[#005a9e]" />
          <span className="truncate text-[11px] font-medium text-[#005a9e]">{primaryService}</span>
          {extraServices.length > 0 && (
            <span className="shrink-0 rounded-sm bg-[#eff6fc] px-1 text-[9px] font-semibold text-[#005a9e]">
              +{extraServices.length}
            </span>
          )}
        </div>

        {/* Hora + operaria */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold tabular-nums text-[#323130]">
            {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
          </span>
          <span className="truncate text-[10px] text-[#605e5c]">{proName}</span>
        </div>

        {remaining ? (
          <p className="text-[10px] font-semibold text-[#0078d4]">{remaining}</p>
        ) : null}

        {/* Ver detalles */}
        <button
          type="button"
          onPointerDown={stopDragPointer}
          onClick={() => setIsDetailOpen((v) => !v)}
          className="mt-1.5 flex w-full items-center gap-1 text-[10px] font-semibold text-[#605e5c] hover:text-[#0078d4]"
        >
          {isDetailOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {isDetailOpen ? "Ocultar detalles" : "Ver detalles"}
        </button>

        {/* Panel de detalles expandible */}
        {isDetailOpen && (
          <div className="mt-1.5 space-y-1 rounded-sm border border-[#edebe9] bg-[#faf9f8] p-2 text-[10px]"
            onPointerDown={stopDragPointer}>
            {ticket.ticket_code && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Código:</span>
                <span className="font-mono text-[#323130]">{ticket.ticket_code}</span>
              </div>
            )}
            {(ticket.service_names?.length ?? 0) > 1 && (
              <div>
                <span className="font-semibold text-[#605e5c]">Servicios:</span>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {ticket.service_names!.map((s, i) => (
                    <span key={i} className="rounded-sm bg-[#eff6fc] px-1 text-[9px] font-semibold text-[#005a9e]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {ticket.client_phone && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Teléfono:</span>
                <span className="text-[#323130]">{ticket.client_phone}</span>
              </div>
            )}
            {ticket.client_age != null && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Edad:</span>
                <span className="text-[#323130]">{ticket.client_age} años</span>
              </div>
            )}
            {ticket.client_eye_type_name && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Tipo de ojo:</span>
                <span className="text-[#323130]">{ticket.client_eye_type_name}</span>
              </div>
            )}
            {ticket.branch_name && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Sucursal:</span>
                <span className="text-[#323130]">{ticket.branch_name}</span>
              </div>
            )}
            {ticket.sale_id && (
              <div className="flex gap-1">
                <span className="font-semibold text-[#605e5c]">Venta:</span>
                <span className="font-semibold text-emerald-700">#{ticket.sale_id}</span>
              </div>
            )}
            <div className="flex gap-1">
              <span className="font-semibold text-[#605e5c]">Estado:</span>
              <span className="text-[#323130]">{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Acciones (Iniciar / Finalizar / Cancelar) ────────────────────────── */}
      <div className="flex items-center justify-between border-t border-[#edebe9] px-2 pb-2 pt-1"
        onPointerDown={stopDragPointer}>
        <div className="min-w-0 flex-1">{actions}</div>
        <button type="button" onPointerDown={stopDragPointer} onClick={() => onDelete(ticket)}
          className="ml-1 shrink-0 border border-transparent p-1 text-[#8a8886] hover:border-[#f1adba] hover:bg-[#fde7e9] hover:text-[#a4262c]">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
