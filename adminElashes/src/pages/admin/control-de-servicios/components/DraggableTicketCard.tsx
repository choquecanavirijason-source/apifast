import { useEffect, useState, type ReactNode } from "react";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

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
  const [date, setDate] = useState(getDateInputValue(ticket.start_time));
  const [time, setTime] = useState(getTimeInputValue(ticket.start_time));
  const [professionalId, setProfessionalId] = useState(ticket.professional_id ? String(ticket.professional_id) : "");
  const [isIa, setIsIa] = useState(Boolean(ticket.is_ia));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDate(getDateInputValue(ticket.start_time));
    setTime(getTimeInputValue(ticket.start_time));
    setProfessionalId(ticket.professional_id ? String(ticket.professional_id) : "");
    setIsIa(Boolean(ticket.is_ia));
    setIsEditing(false);
  }, [ticket.id, ticket.start_time, ticket.professional_id, ticket.is_ia]);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow ${
        isEditing ? "cursor-default" : "cursor-pointer active:cursor-grabbing"
      } ${
        isDragging ? "shadow-lg ring-2 ring-slate-300" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex cursor-grab touch-none shrink-0 items-center justify-center rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{ticket.client_name}</p>
            <p className="text-xs text-slate-500">{ticket.branch_name ?? "Sin sucursal"}</p>
            {showRemaining ? (
              <p className="mt-1 text-xs font-semibold text-emerald-600">{getRemainingLabel(ticket.end_time)}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[12px] font-bold capitalize ${
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label="Eliminar ticket"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p>Servicios: {(ticket.service_names ?? [ticket.service_name ?? "-"]).filter(Boolean).join(" · ")}</p>
        <p>
          Hora: {formatTime(ticket.start_time)} - {formatTime(ticket.end_time)}
        </p>
        <div className="pt-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Operaria</p>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {assignedProfessional}
          </span>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
            />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</p>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
            />
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Operaria</p>
            <select
              value={professionalId}
              onChange={(event) => setProfessionalId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
            >
              <option value="">Sin operaria</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={String(professional.id)}>
                  {professional.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ticket IA</p>
            <label className="inline-flex h-[30px] w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
              <span>{isIa ? "Activo" : "No"}</span>
              <input
                type="checkbox"
                checked={isIa}
                onChange={(event) => setIsIa(event.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={() => {
                onSaveEdits(ticket, { date, time, professionalId, isIa });
                setIsEditing(false);
              }}
              disabled={isSavingEdit}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDate(getDateInputValue(ticket.start_time));
                setTime(getTimeInputValue(ticket.start_time));
                setProfessionalId(ticket.professional_id ? String(ticket.professional_id) : "");
                setIsIa(Boolean(ticket.is_ia));
                setIsEditing(false);
              }}
              disabled={isSavingEdit}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}
