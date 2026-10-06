import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Info, Pencil, Plus, Scissors, Trash2, User, UserCog } from "lucide-react";

import type { ClientForSelect, ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { formatTime } from "../control.constants";
import { ticketCardClass } from "../../calendar/dailyAgenda.utils";

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
  onDelete, professionals, busyProfessionalIds, onSaveEdits, isSavingEdit,
  clients, onChangeClient, onOpenRegisterClient, compact = false,
}: {
  ticket: TicketItem;
  actions: ReactNode;
  showRemaining: boolean;
  statusColors: Record<string, string>;
  getRemainingLabel: (endTime: string) => string;
  onDelete: (ticket: TicketItem) => void;
  professionals: ProfessionalForSelect[];
  /** IDs de operarias con un ticket "en servicio" ahora mismo, derivado en
   * vivo de los tickets del tablero — más confiable que `professional.is_busy`,
   * que es una foto de otro fetch y puede quedar desactualizada. */
  busyProfessionalIds?: Set<number>;
  onSaveEdits: (ticket: TicketItem, payload: { date: string; time: string; professionalId: string; isIa: boolean }) => void;
  isSavingEdit: boolean;
  /** Clientas disponibles para reasignar el ticket (o dejarlo como "Cliente Mostrador"). */
  clients?: ClientForSelect[];
  onChangeClient?: (ticket: TicketItem, clientId: string) => void;
  onOpenRegisterClient?: (ticket: TicketItem) => void;
  /** Versión reducida (2 líneas) para columnas con muchos tickets. */
  compact?: boolean;
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

  // Con el popup de "Ajustar turno" o el panel de "Info" abiertos, el ticket
  // debería poder seguir arrastrándose a otra columna sin tener que cerrarlo
  // primero — sus propios controles ya frenan el drag por su cuenta (stopPtr).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: { ticket, column: ticket.status },
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


  const fieldCls =
    "h-8 w-full cursor-pointer rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-input)] px-2 text-xs text-[var(--ui-text)] outline-none transition focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20";

  const canEdit = canEditOperaria || canEditClient;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => {
        // Doble clic = editar (como en la Agenda); si no se puede editar, muestra el detalle.
        if (canEdit) setEditOpen(true);
        else setDetailOpen((v) => !v);
      }}
      title={canEdit ? "Arrastra para mover de columna · doble clic para editar" : "Arrastra para mover de columna"}
      className={`group relative cursor-grab touch-none select-none rounded-lg border border-l-[3px] shadow-sm transition-shadow active:cursor-grabbing ${ticketCardClass(ticket.status)} ${
        isDragging ? "border-dashed opacity-40 shadow-none" : "hover:shadow-md"
      }`}
    >
      {/* ── Cuerpo: mismo estilo que los bloques de la Agenda ─────────────── */}
      <div className={compact ? "px-2 py-1.5" : "px-2.5 py-2"}>
        {/* Línea 1: clienta + horario + acciones de icono */}
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[12px] font-semibold">{ticket.client_name}</span>
              <span className="shrink-0 text-[11px] tabular-nums opacity-75">
                {formatTime(ticket.start_time)}
                {compact ? "" : ` – ${formatTime(ticket.end_time)}`}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-1 text-[11px] opacity-90">
              <Scissors size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{primarySvc}</span>
              {extraCount > 0 && <span className="shrink-0 font-semibold">+{extraCount}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onPointerDown={stopPtr} onClick={() => setDetailOpen((v) => !v)}
              title="Ver detalles"
              className={`rounded-md p-1 transition-colors ${detailOpen ? "bg-black/10" : "opacity-60 hover:bg-black/5 hover:opacity-100"}`}>
              <Info size={12} />
            </button>
            {canEdit && (
              <button type="button" onPointerDown={stopPtr} onClick={() => setEditOpen(true)}
                title="Editar: operaria, clienta, fecha y hora (o doble clic)"
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                  hasChanges ? "bg-black/10" : "opacity-70 hover:bg-black/5 hover:opacity-100"
                }`}>
                <Pencil size={11} />
                {!compact && "Editar"}
              </button>
            )}
          </div>
        </div>

        {/* Línea 2: operaria + tiempo restante */}
        <div className={`flex items-center justify-between gap-1.5 ${compact ? "mt-1" : "mt-1.5"}`}>
          {canEditOperaria ? (
            <button
              type="button"
              onPointerDown={stopPtr}
              onClick={() => setEditOpen(true)}
              title={proName ? "Cambiar operaria" : "Asignar operaria"}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                proName
                  ? "border-current/25 bg-white/60 hover:bg-white"
                  : "border-dashed border-[#9F8351] bg-[#9F8351]/10 text-[#85754a] hover:bg-[#9F8351]/20"
              }`}
            >
              <UserCog size={11} className="shrink-0" />
              <span className="truncate">{proName ?? "Asignar operaria"}</span>
              <ChevronDown size={10} className="shrink-0 opacity-60" />
            </button>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] opacity-80">
              <User size={11} className="shrink-0" />
              <span className="truncate">{proName ?? "Sin operaria"}</span>
            </span>
          )}
          {remaining && (
            <span className="shrink-0 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {remaining}
            </span>
          )}
        </div>

        {/* Edición en línea (doble clic o "Editar"): dentro de la tarjeta, nunca se corta */}
        {editOpen && canEdit && (
          <div
            ref={editRef}
            className="mt-2 space-y-2 rounded-md border border-current/15 bg-[var(--ui-surface)] p-2 text-[var(--ui-text)]"
            onPointerDown={stopPtr}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold">Editar turno</span>
              <span className="flex items-center gap-2">
                {hasChanges && (
                  <span className="text-[10px] text-[var(--ui-text-muted)]">
                    {isSavingEdit ? "Guardando…" : "Se guarda solo"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-medium text-white hover:bg-brand-hover"
                >
                  Listo
                </button>
              </span>
            </div>

            {canEditOperaria && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)]">
                  <UserCog size={11} /> Operaria
                </span>
                <select value={quickProId} onChange={(e) => setQuickProId(e.target.value)} className={fieldCls}>
                  <option value="">Sin operaria</option>
                  {professionals.map((p) => {
                    const inService = busyProfessionalIds?.has(p.id) ?? (p.is_busy === true);
                    // No se bloquea a las ocupadas: elegirla la deja en su cola para cuando se libere.
                    return (
                      <option key={p.id} value={String(p.id)}>
                        {p.username} — {inService ? "En servicio" : "Libre"}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            {canEditClient && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] text-[var(--ui-text-muted)]">
                  <User size={11} /> Clienta
                </span>
                <span className="flex gap-1.5">
                  <select
                    value={String(ticket.client_id ?? "")}
                    onChange={(e) => onChangeClient?.(ticket, e.target.value)}
                    className={`${fieldCls} min-w-0 flex-1`}
                  >
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={String(c.id)}>{`${c.nombre} ${c.apellido}`.trim()}</option>
                    ))}
                  </select>
                  {onOpenRegisterClient && (
                    <button
                      type="button"
                      onClick={() => onOpenRegisterClient(ticket)}
                      title="Registrar nueva clienta"
                      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--ui-border-strong)] px-2 text-[11px] font-medium hover:bg-[var(--ui-surface-hover)]"
                    >
                      <Plus size={12} /> Nueva
                    </button>
                  )}
                </span>
              </label>
            )}
          </div>
        )}

        {/* Detalle expandible */}
        {detailOpen && (
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-md bg-white/60 p-2 text-[11px]" onPointerDown={stopPtr}>
            <div className="col-span-2 flex gap-1.5">
              <span className="shrink-0 opacity-70">Código:</span>
              <span className="font-mono">{ticket.ticket_code ?? `#${ticket.id}`}</span>
            </div>
            <div className="col-span-2 flex gap-1.5">
              <span className="shrink-0 opacity-70">Horario:</span>
              <span className="tabular-nums">{formatTime(ticket.start_time)} – {formatTime(ticket.end_time)}</span>
            </div>
            {ticket.client_phone && (
              <div className="flex gap-1.5">
                <span className="shrink-0 opacity-70">Tel:</span>
                <span className="truncate">{ticket.client_phone}</span>
              </div>
            )}
            {ticket.client_age != null && (
              <div className="flex gap-1.5">
                <span className="shrink-0 opacity-70">Edad:</span>
                <span>{ticket.client_age} años</span>
              </div>
            )}
            {ticket.client_eye_type_name && (
              <div className="flex gap-1.5">
                <span className="shrink-0 opacity-70">Ojos:</span>
                <span className="truncate">{ticket.client_eye_type_name}</span>
              </div>
            )}
            {ticket.sale_id && (
              <div className="flex gap-1.5">
                <span className="shrink-0 opacity-70">Venta:</span>
                <span className="font-semibold">#{ticket.sale_id}</span>
              </div>
            )}
            {(ticket.service_names?.length ?? 0) > 1 && (
              <div className="col-span-2 mt-0.5 flex flex-wrap gap-1">
                {ticket.service_names!.map((svc, i) => (
                  <span key={i} className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium">{svc}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div
          className={`flex items-center gap-1.5 ${compact ? "mt-1" : "mt-2"} [&_button]:text-[11px] ${
            compact ? "[&_button]:!px-2 [&_button]:!py-0.5" : ""
          }`}
          onPointerDown={stopPtr}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1">{actions}</div>
          <button
            type="button"
            onPointerDown={stopPtr}
            onClick={() => onDelete(ticket)}
            title="Eliminar ticket"
            className="shrink-0 rounded-md p-1 opacity-50 transition hover:bg-rose-50 hover:text-rose-700 hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
