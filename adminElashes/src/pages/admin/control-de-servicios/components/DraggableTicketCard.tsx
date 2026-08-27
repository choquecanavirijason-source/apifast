import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  Clock, GripVertical, Info, Plus, Scissors, Trash2, User, X,
} from "lucide-react";

import type { ClientForSelect, ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
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

const stopPtr = (e: React.PointerEvent) => e.stopPropagation();

export default function DraggableTicketCard({
  ticket, actions, showRemaining, getRemainingLabel,
  onDelete, professionals, onSaveEdits, isSavingEdit,
  clients, onChangeClient, onOpenRegisterClient,
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
  /** Clientas disponibles para reasignar el ticket (o dejarlo como "Cliente Mostrador"). */
  clients?: ClientForSelect[];
  onChangeClient?: (ticket: TicketItem, clientId: string) => void;
  onOpenRegisterClient?: (ticket: TicketItem) => void;
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
    const changed = quickProId !== (ticket.professional_id ? String(ticket.professional_id) : "");
    if (!changed || savingRef.current) return;
    const key = quickProId;
    if (key === lastKeyRef.current) return;
    timerRef.current = window.setTimeout(() => {
      lastKeyRef.current = key;
      onSaveEdits(ticket, { date: quickDate, time: quickTime, professionalId: quickProId, isIa: Boolean(ticket.is_ia) });
    }, 800);
    return () => { if (timerRef.current != null) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickProId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) setEditOpen(false);
    };
    if (editOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editOpen]);

  // Con el popup de "Ajustar turno" abierto, el ticket debería poder seguir
  // arrastrándose a otra columna sin tener que cerrarlo con la X primero —
  // los controles del popup ya frenan el drag por su cuenta (stopPtr).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket, column: ticket.status },
    disabled: detailOpen,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    opacity: isDragging ? 0.35 : 1,
    touchAction: "none",
  };

  const hasChanges =
    quickDate !== getDateInputValue(ticket.start_time) ||
    quickProId !== (ticket.professional_id ? String(ticket.professional_id) : "") ||
    quickTime !== getTimeInputValue(ticket.start_time);

  const canEditOperaria = ["pending", "waiting", "confirmed"].includes(ticket.status);
  // La clienta se puede corregir hasta que el ticket se finalice — después de
  // eso, la venta/tracking ya quedaron registrados a su nombre.
  const canEditClient = Boolean(onChangeClient) && ["pending", "waiting", "confirmed", "in_service"].includes(ticket.status);

  const primarySvc = ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio";
  const extraCount = (ticket.service_names?.length ?? 0) - 1;
  const remaining = showRemaining ? getRemainingLabel(ticket.end_time) : "";
  const proName = professionals.find((p) => String(p.id) === String(ticket.professional_id))?.username
    ?? ticket.professional_name ?? null;

  const initials = (ticket.client_name ?? "?").slice(0, 2).toUpperCase();

  const inputCls = "h-8 w-full rounded-md border border-[#c8c6c4] bg-white px-2.5 text-xs text-[#323130] outline-none transition focus:border-[#201f1e] focus:ring-2 focus:ring-[#201f1e]/10";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab touch-none rounded-xl border bg-white transition-all active:cursor-grabbing ${
        isDragging
          ? "border-dashed border-[#201f1e] shadow-none"
          : "border-[#c8c6c4] hover:border-[#8a8886]"
      }`}
    >
      {/* ── Popup de edición ──────────────────────────────────────────────── */}
      {editOpen && (canEditOperaria || canEditClient) && (
        <>
          <div className="absolute inset-0 z-40 rounded-xl bg-white/60 backdrop-blur-[2px]" />
          <div
            ref={editRef}
            className="absolute inset-x-0 top-0 z-50 select-none rounded-xl bg-white shadow-2xl ring-1 ring-black/10"
          >
            {/* Header y bloque de info: sin stopPtr a propósito — con el popup
                abierto, esta zona sigue sirviendo para arrastrar el ticket a
                otra columna sin tener que cerrarlo con la X primero. */}
            {/* Header */}
            <div className="flex cursor-grab items-center justify-between rounded-t-xl bg-[#f3f2f1] px-3 py-2.5 border-b border-[#e8e4dc]">
              <div className="flex items-center gap-2">
                <GripVertical size={12} className="shrink-0 text-[#a19f9d]" />
                <div className="h-3.5 w-0.5 rounded-full bg-[#201f1e]" />
                <span className="text-[11px] font-semibold text-[#201f1e]">Ajustar turno</span>
                {hasChanges && (
                  <span className="flex items-center gap-1 rounded-full border border-[#c8c6c4] px-1.5 py-0.5 text-[9px] font-semibold text-[#201f1e]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#201f1e]" />
                    {isSavingEdit ? "Guardando…" : "Guardado automático"}
                  </span>
                )}
              </div>
              <button type="button" onPointerDown={stopPtr} onClick={() => setEditOpen(false)}
                className="rounded-md p-1 text-[#8a8886] hover:bg-[#ececec] hover:text-[#201f1e] transition-colors">
                <X size={12} />
              </button>
            </div>

            {/* Info del ticket */}
            <div className="cursor-grab border-b border-[#f0efed] bg-[#fafaf9] px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c8c6c4] bg-white text-[11px] font-bold text-[#201f1e]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#201f1e]">{ticket.client_name}</p>
                  {ticket.ticket_code && (
                    <p className="text-[10px] font-mono text-[#a19f9d]">{ticket.ticket_code}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-[42px]">
                <Scissors size={11} className="shrink-0 text-[#605e5c]" />
                <span className="truncate text-[11px] text-[#605e5c]">{primarySvc}</span>
                {extraCount > 0 && (
                  <span className="shrink-0 rounded border border-[#c8c6c4] px-1 py-0.5 text-[9px] font-bold text-[#605e5c]">+{extraCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pl-[42px]">
                <Clock size={11} className="shrink-0 text-[#8a8886]" />
                <span className="text-[11px] tabular-nums text-[#8a8886]">
                  {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
                </span>
              </div>
            </div>

            {/* Selector operaria */}
            {canEditOperaria && (
              <div className="p-3 border-b border-[#f0efed]">
                <label className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#8a8886]">
                  <User size={8} /> Asignar operaria
                </label>
                <select value={quickProId} onPointerDown={stopPtr}
                  onChange={(e) => setQuickProId(e.target.value)}
                  className={`${inputCls} cursor-pointer`}>
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => {
                    const inService = p.is_busy === true;
                    // Al <option> nativo no se le puede poner color/badge —
                    // se marca en el texto. No se bloquea a las ocupadas: este
                    // selector solo aparece en tickets "en espera", así que
                    // elegir a una operaria ocupada es justo la forma de
                    // ponerla en su cola para cuando se libere.
                    return (
                      <option key={p.id} value={String(p.id)}>
                        {p.username} — {inService ? "En servicio" : "Libre"}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Selector clienta — corregir "Cliente Mostrador" o cambiar de clienta */}
            {canEditClient && (
              <div className="p-3">
                <label className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-[#8a8886]">
                  <User size={8} /> Clienta
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={String(ticket.client_id ?? "")}
                    onPointerDown={stopPtr}
                    onChange={(e) => onChangeClient?.(ticket, e.target.value)}
                    className={`${inputCls} min-w-0 flex-1 cursor-pointer`}
                  >
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={String(c.id)}>{`${c.nombre} ${c.apellido}`.trim()}</option>
                    ))}
                  </select>
                  {onOpenRegisterClient && (
                    <button
                      type="button"
                      onPointerDown={stopPtr}
                      onClick={() => onOpenRegisterClient(ticket)}
                      title="Registrar nueva clienta"
                      className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#201f1e] bg-white px-2 text-[10px] font-semibold text-[#201f1e] transition hover:bg-[#f3f2f1]"
                    >
                      <Plus size={12} /> Nueva
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Cabecera de la tarjeta: código + drag + acciones icon ─────────── */}
      <div className="flex items-center justify-between rounded-t-xl bg-[#faf9f8] px-3 py-2 border-b border-[#f0efed]">
        <div className="flex items-center gap-1.5">
          <GripVertical size={13} className="shrink-0 text-[#c8c6c4] group-hover:text-[#8a8886] transition-colors cursor-grab" />
          {ticket.ticket_code ? (
            <span className="rounded border border-[#c8c6c4] px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[#201f1e]">
              {ticket.ticket_code}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-[#a19f9d]">#{ticket.id}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onPointerDown={stopPtr} onClick={() => setDetailOpen((v) => !v)}
            title="Ver detalles"
            className={`rounded-lg p-1.5 transition-colors ${
              detailOpen ? "bg-[#ececec] text-[#201f1e]" : "text-[#c8c6c4] hover:bg-[#f3f1ec] hover:text-[#605e5c]"
            }`}>
            <Info size={13} />
          </button>
          {(canEditOperaria || canEditClient) && (
            <button type="button" onPointerDown={stopPtr} onClick={() => setEditOpen(true)}
              title="Ajustar turno"
              className={`rounded-lg p-1.5 transition-colors ${
                hasChanges ? "bg-[#f3f2f1] text-[#201f1e]" : "text-[#c8c6c4] hover:bg-[#f3f1ec] hover:text-[#605e5c]"
              }`}>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Cuerpo de la tarjeta ─────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2">

        {/* Avatar + nombre */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c8c6c4] bg-white text-[12px] font-bold text-[#201f1e]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-[#201f1e]">
              {ticket.client_name}
            </p>
            {canEditOperaria ? (
              <button
                type="button"
                onPointerDown={stopPtr}
                onClick={() => setEditOpen(true)}
                className={`mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 -ml-1 transition-colors hover:bg-[#f3f2f1] ${
                  proName ? "" : "animate-pulse"
                }`}
              >
                <User size={10} className="shrink-0 text-[#605e5c]" />
                <span className="truncate text-[11px] font-medium text-[#605e5c] underline decoration-dotted">
                  {proName ?? "Asignar operaria"}
                </span>
              </button>
            ) : (
              <div className="mt-0.5 flex items-center gap-1">
                <User size={10} className={proName ? "shrink-0 text-[#605e5c]" : "shrink-0 text-[#c8c6c4]"} />
                <span className={`truncate text-[11px] ${proName ? "font-medium text-[#605e5c]" : "italic text-[#a19f9d]"}`}>
                  {proName ?? "Sin operaria asignada"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Servicio */}
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-[#e0dedd] px-2.5 py-1.5">
          <Scissors size={12} className="shrink-0 text-[#605e5c]" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#201f1e]">{primarySvc}</span>
          {extraCount > 0 && (
            <span className="shrink-0 rounded-md border border-[#c8c6c4] px-1.5 py-0.5 text-[9px] font-bold text-[#605e5c]">
              +{extraCount}
            </span>
          )}
        </div>

        {/* Horario + tiempo restante */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="shrink-0 text-[#8a8886]" />
            <span className="text-[11px] tabular-nums text-[#605e5c]">
              {formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}
            </span>
          </div>
          {remaining && (
            <span className="rounded-full border border-[#c8c6c4] px-2 py-0.5 text-[10px] font-bold text-[#605e5c]">
              {remaining}
            </span>
          )}
        </div>

        {/* Panel de detalles expandible */}
        {detailOpen && (
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-[#e8e4dc] bg-[#faf8f4] p-2.5 text-[11px]"
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
                <span className="font-semibold text-[#201f1e]">#{ticket.sale_id}</span>
              </div>
            )}
            {(ticket.service_names?.length ?? 0) > 1 && (
              <div className="col-span-2 mt-0.5 flex flex-wrap gap-1">
                {ticket.service_names!.map((s, i) => (
                  <span key={i} className="rounded-md border border-[#c8c6c4] px-1.5 py-0.5 text-[10px] font-semibold text-[#605e5c]">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 border-t border-[#f0efed] px-3 pb-3 pt-2.5"
        onPointerDown={stopPtr}
      >
        <div className="min-w-0 flex-1">{actions}</div>
        <button
          type="button"
          onPointerDown={stopPtr}
          onClick={() => onDelete(ticket)}
          title="Eliminar ticket"
          className="shrink-0 rounded-lg border border-transparent p-1.5 text-[#c4b08a] transition-colors hover:border-[#f1adba] hover:bg-[#fde7e9] hover:text-[#a4262c]"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
