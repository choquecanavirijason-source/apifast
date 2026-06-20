import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar, ChevronRight,
  Clock, GripVertical, Info, Scissors, Trash2, User, X,
} from "lucide-react";

import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime } from "../control.constants";

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
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
};

// primary=#094732 secondary=#9F8351 cancelled red kept
const ACCENT: Record<string, string> = {
  pending: "#9F8351", waiting: "#9F8351", confirmed: "#9F8351",
  in_service: "#094732", completed: "#126b4a", cancelled: "#A4262C",
};

const stopPtr = (e: React.PointerEvent) => e.stopPropagation();

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
  onSaveEdits: (ticket: TicketItem, payload: { date: string; time: string; professionalId: string; isIa: boolean }) => void;
  isSavingEdit: boolean;
}) {
  const [quickDate, setQuickDate] = useState(getDateInputValue(ticket.start_time));
  const [quickProId, setQuickProId] = useState(ticket.professional_id ? String(ticket.professional_id) : "");
  const [quickTime, setQuickTime] = useState(getTimeInputValue(ticket.start_time));
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const lastKeyRef = useRef("");
  const savingRef = useRef(isSavingEdit);

  useEffect(() => { savingRef.current = isSavingEdit; }, [isSavingEdit]);

  useEffect(() => {
    setQuickDate(getDateInputValue(ticket.start_time));
    setQuickProId(ticket.professional_id ? String(ticket.professional_id) : "");
    setQuickTime(getTimeInputValue(ticket.start_time));
  }, [ticket.id, ticket.start_time, ticket.professional_id]);

  useEffect(() => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
    const changed =
      quickDate !== getDateInputValue(ticket.start_time) ||
      quickProId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
      quickTime !== getTimeInputValue(ticket.start_time);
    if (!changed || savingRef.current) return;
    const key = `${quickDate}|${quickTime}|${quickProId}`;
    if (key === lastKeyRef.current) return;
    timerRef.current = window.setTimeout(() => {
      lastKeyRef.current = key;
      onSaveEdits(ticket, { date: quickDate, time: quickTime, professionalId: quickProId, isIa: Boolean(ticket.is_ia) });
    }, 800);
    return () => { if (timerRef.current != null) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickDate, quickProId, quickTime]);

  useEffect(() => {
    if (editOpen) setQuickTime(getTimeInputValue(new Date().toISOString()));
  }, [editOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) setEditOpen(false);
    };
    if (editOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editOpen]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket, column: ticket.status },
    disabled: editOpen || detailOpen,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.35 : 1,
    borderLeft: `3px solid ${ACCENT[ticket.status] ?? "#c4b08a"}`,
    touchAction: "none",
  };

  const hasChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const primarySvc = ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio";
  const extraCount = (ticket.service_names?.length ?? 0) - 1;
  const remaining = showRemaining ? getRemainingLabel(ticket.end_time) : "";
  const proName = professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username
    ?? ticket.professional_name ?? null;

  const inputCls = "h-8 w-full rounded-md border border-[#c4b08a] bg-white px-2.5 text-xs text-[#323130] outline-none transition focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab touch-none rounded-md border border-[#e0dedd] bg-white transition-all active:cursor-grabbing ${
        isDragging ? "shadow-none ring-2 ring-dashed ring-[#9F8351]" : "shadow-sm hover:shadow-md hover:border-[#c4b08a]"
      }`}
    >
      {/* ── Popup de edición ────────────────────────────────────────────────── */}
      {editOpen && (
        <>
          <div className="absolute inset-0 z-40 rounded-md bg-white/50 backdrop-blur-[2px]" />
          <div
            ref={editRef}
            onPointerDown={stopPtr}
            className="absolute inset-x-0 top-0 z-50 rounded-md bg-white shadow-2xl ring-1 ring-black/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-md bg-linear-to-r from-[#f8f7f4] to-[#f3f1ec] px-3 py-2 border-b border-[#e8e4dc]">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-0.5 rounded-full bg-[#094732]" />
                <span className="text-[11px] font-semibold text-[#201f1e]">Ajustar turno</span>
                {hasChanges && (
                  <span className="flex items-center gap-1 rounded-full bg-[#094732]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#094732]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#094732]" />
                    {isSavingEdit ? "Guardando…" : "Sin guardar"}
                  </span>
                )}
              </div>
              <button type="button" onPointerDown={stopPtr} onClick={() => setEditOpen(false)}
                className="rounded-md p-1 text-[#8a8886] hover:bg-[#ecfdf5] hover:text-[#094732] transition-colors">
                <X size={12} />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="space-y-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#8a8886]">
                    <Calendar size={8} /> Fecha inicio
                  </label>
                  <div className="h-8 w-full rounded-md border border-[#c4b08a] bg-[#faf8f4] px-2.5 text-xs text-[#605e5c] flex items-center select-none cursor-default tabular-nums">
                    {quickDate}
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#8a8886]">
                    <Clock size={8} /> Hora actual
                  </label>
                  <div className="h-8 w-full rounded-md border border-[#c4b08a] bg-[#faf8f4] px-2.5 text-xs text-[#605e5c] flex items-center select-none cursor-default tabular-nums">
                    {quickTime}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#8a8886]">
                  <User size={8} /> Operaria
                </label>
                <select value={quickProId} onPointerDown={stopPtr}
                  onChange={(e) => setQuickProId(e.target.value)}
                  className={`${inputCls} cursor-pointer`}>
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.username}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Cuerpo de la tarjeta ─────────────────────────────────────────────── */}
      <div className="p-3.5">

        {/* Fila 1: drag + nombre + iconos */}
        <div className="flex items-center gap-2">
          <GripVertical size={15} className="shrink-0 text-[#c4b08a] group-hover:text-[#094732] transition-colors" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-[#201f1e]">
            {ticket.client_name}
          </p>
          <button type="button" onPointerDown={stopPtr} onClick={() => setDetailOpen((v) => !v)}
            title="Ver detalles"
            className={`shrink-0 rounded-lg p-1.5 transition-colors ${
              detailOpen ? "bg-[#ecfdf5] text-[#094732]" : "text-[#c8c6c4] hover:bg-[#f3f1ec] hover:text-[#605e5c]"
            }`}>
            <Info size={14} />
          </button>
          <button type="button" onPointerDown={stopPtr} onClick={() => setEditOpen(true)}
            title="Editar turno"
            className={`shrink-0 rounded-lg p-1.5 transition-colors ${
              hasChanges ? "bg-[#faf7f0] text-[#9F8351]" : "text-[#c8c6c4] hover:bg-[#f3f1ec] hover:text-[#605e5c]"
            }`}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Fila 2: servicio */}
        <div className="mt-2.5 flex items-center gap-1.5">
          <Scissors size={12} className="shrink-0 text-[#094732]" />
          <span className="min-w-0 truncate text-xs font-semibold text-[#094732]">{primarySvc}</span>
          {extraCount > 0 && (
            <span className="shrink-0 rounded-md bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#094732]">
              +{extraCount}
            </span>
          )}
        </div>

        {/* Fila 3: operaria */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <User size={12} className={proName ? "shrink-0 text-[#9F8351]" : "shrink-0 text-[#c8c6c4]"} />
          <span className={`truncate text-xs font-medium ${proName ? "text-[#9F8351]" : "italic text-[#a19f9d]"}`}>
            {proName ?? "Sin asignar"}
          </span>
        </div>

        {/* Fila 4: horario + tiempo espera */}
        <div className="mt-2 flex items-center justify-between border-t border-[#f0efed] pt-2">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="shrink-0 text-[#8a8886]" />
            <span className="text-xs font-semibold tabular-nums text-[#323130]">
              {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
            </span>
          </div>
          {remaining && (
            <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold text-[#094732]">
              {remaining}
            </span>
          )}
        </div>

        {/* Panel de detalles expandible */}
        {detailOpen && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-[#e8e4dc] bg-[#faf8f4] p-2.5 text-[11px]"
            onPointerDown={stopPtr}>
            {ticket.ticket_code && (
              <div className="col-span-2 flex gap-1.5">
                <span className="shrink-0 font-semibold text-[#8a8886]">Código:</span>
                <span className="font-mono text-[#323130]">{ticket.ticket_code}</span>
              </div>
            )}
            {ticket.client_phone && (
              <div className="flex gap-1.5">
                <span className="shrink-0 font-semibold text-[#8a8886]">Tel:</span>
                <span className="truncate text-[#323130]">{ticket.client_phone}</span>
              </div>
            )}
            {ticket.client_age != null && (
              <div className="flex gap-1.5">
                <span className="shrink-0 font-semibold text-[#8a8886]">Edad:</span>
                <span className="text-[#323130]">{ticket.client_age} años</span>
              </div>
            )}
            {ticket.client_eye_type_name && (
              <div className="flex gap-1.5">
                <span className="shrink-0 font-semibold text-[#8a8886]">Ojos:</span>
                <span className="truncate text-[#323130]">{ticket.client_eye_type_name}</span>
              </div>
            )}
            {ticket.sale_id && (
              <div className="flex gap-1.5">
                <span className="shrink-0 font-semibold text-[#8a8886]">Venta:</span>
                <span className="font-semibold text-[#9F8351]">#{ticket.sale_id}</span>
              </div>
            )}
            {(ticket.service_names?.length ?? 0) > 1 && (
              <div className="col-span-2 mt-0.5 flex flex-wrap gap-1">
                {ticket.service_names!.map((s, i) => (
                  <span key={i} className="rounded-md bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-semibold text-[#094732]">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-[#f0efed] bg-[#faf8f4] px-3.5 pb-3 pt-2.5 rounded-b-md"
        onPointerDown={stopPtr}>
        <div className="min-w-0 flex-1">{actions}</div>
        <button type="button" onPointerDown={stopPtr} onClick={() => onDelete(ticket)}
          className="shrink-0 rounded-lg border border-transparent p-1.5 text-[#c4b08a] transition-colors hover:border-[#f1adba] hover:bg-[#fde7e9] hover:text-[#a4262c]">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
