import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Calendar, Clock, User, X, ChevronRight } from "lucide-react";

import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime, STATUS_LABELS } from "../control.constants";

// --- Funciones de ayuda (Sin cambios) ---
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
  pending: "#D83B01", waiting: "#D83B01", confirmed: "#D83B01",
  in_service: "#0078D4", completed: "#107C10", cancelled: "#A4262C",
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
  ticket, actions, showRemaining, getRemainingLabel, onDelete, professionals, onSaveEdits, isSavingEdit,
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
  const [quickError, setQuickError] = useState("");
  const isIa = Boolean(ticket.is_ia);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
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

    const hasChanges = quickDate !== getDateInputValue(ticket.start_time) ||
                       quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
                       quickTime !== getTimeInputValue(ticket.start_time);

    if (!hasChanges || isSavingEditRef.current) return;

    // Evitar reenviar el mismo payload si ya se intentó (p.ej. después de un error)
    const submitKey = `${quickDate}|${quickTime}|${quickProfessionalId}`;
    if (submitKey === lastAutoSubmitKeyRef.current) return;

    quickSaveTimerRef.current = window.setTimeout(() => {
      lastAutoSubmitKeyRef.current = submitKey;
      onSaveEdits(ticket, { date: quickDate, time: quickTime, professionalId: quickProfessionalId, isIa });
    }, 800);

    return () => { if (quickSaveTimerRef.current != null) window.clearTimeout(quickSaveTimerRef.current); };
  // isSavingEdit intencionalmente excluido: usamos el ref para no re-disparar el efecto al fallar
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
    data: { ticket },
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.6 : 1,
    borderLeft: `4px solid ${STATUS_STRIP[ticket.status] ?? "#D2D0CE"}`,
  };

  const badge = STATUS_BADGE[ticket.status] ?? { bg: "#F3F2F1", border: "#D2D0CE", color: "#605E5C" };
  const hasQuickChanges = quickDate !== getDateInputValue(ticket.start_time) || 
                          quickProfessionalId !== (ticket.professional_id ? String(ticket.professional_id) : "") || 
                          quickTime !== getTimeInputValue(ticket.start_time);

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group border border-[#d2d0ce] bg-white transition-all ${
        isDragging ? "shadow-2xl scale-[1.02] z-50" : "shadow-sm hover:shadow-md"
      }`}
    >
      {/* POP-UP MODERNO */}
      {isPopupOpen && (
        <>
          {/* Backdrop sutil para enfocar el popup */}
          <div className="absolute inset-0 z-[60] bg-white/40 backdrop-blur-[1px]" />
          
          <div 
            ref={popoverRef}
            className="absolute left-1/2 -translate-x-1/2 top-2 z-[70] w-[95%] bg-white border border-gray-200 shadow-2xl rounded-xl p-4 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Ajustar Turno</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Cambios automáticos</p>
              </div>
              <button onClick={() => setIsPopupOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Calendar size={12}/> FECHA</label>
                  <input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Clock size={12}/> HORA</label>
                  <input type="time" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><User size={12}/> PROFESIONAL ASIGNADO</label>
                <select value={quickProfessionalId} onChange={(e) => setQuickProfessionalId(e.target.value)} className={inputClass}>
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => <option key={p.id} value={String(p.id)}>{p.username}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                {["Ahora", "+15 min", "+30 min"].map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (label === "Ahora") setQuickTime(getTimeInputValue(new Date().toISOString()));
                      else setQuickTime((p) => addMinutesToTime(p, label === "+15 min" ? 15 : 30));
                    }}
                    className="flex-1 py-1.5 border border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-300 hover:text-blue-600 rounded-md text-[10px] font-bold transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {hasQuickChanges && (
              <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-blue-50 rounded-lg">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-blue-600">
                  {isSavingEdit ? "SINCRONIZANDO..." : "CAMBIOS PENDIENTES"}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* CUERPO DEL TICKET */}
      <div className="p-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div {...attributes} {...listeners} className="p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing text-gray-300 group-hover:text-gray-500 transition-colors">
              <GripVertical size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-sm truncate">{ticket.client_name}</h3>
              <span className="text-[10px] text-gray-400 font-medium">{ticket.branch_name || "Central"}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsPopupOpen(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
              hasQuickChanges 
              ? "bg-amber-100 text-amber-700 ring-2 ring-amber-200 animate-pulse" 
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            EDITAR <ChevronRight size={10} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2 border-y border-gray-50">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-700">{formatTime(ticket.start_time)} - {formatTime(ticket.end_time)}</span>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">Horario</span>
          </div>
          <div className="text-right">
            <span 
              className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase"
              style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
            >
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[#107C10] bg-green-50 px-2 py-1 rounded-full">
            <User size={10} />
            <span className="text-[10px] font-bold">{professionals.find(p => String(p.id) === String(ticket.professional_id))?.username || "Sin asignar"}</span>
          </div>
          <button onClick={() => onDelete(ticket)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        {actions}
      </div>
    </div>
  );
}