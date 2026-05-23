import { useState } from "react";
import { CheckCircle2, MessageCircle, Send } from "lucide-react";
import { toast } from "react-toastify";
import { AgendaService, type TicketItem } from "../../../../core/services/agenda/agenda.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";
import { parseTicketDate } from "../dailyAgenda.utils";
import { Button } from "../../../../components/common/ui";

type Props = {
  tickets: TicketItem[];
  branchLabel: string;
  selectedDate: string;
  onTicketUpdated: (ticket: TicketItem) => void;
};

function formatSlot(iso: string) {
  const d = parseTicketDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "confirmed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "waiting") return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-sky-100 text-sky-900 border-sky-200";
}

function ValidationTicketRow({
  ticket,
  onTicketUpdated,
}: {
  ticket: TicketItem;
  onTicketUpdated: (ticket: TicketItem) => void;
}) {
  const [busy, setBusy] = useState<"whatsapp" | "approve" | null>(null);

  const phone = ticket.client?.phone ?? ticket.client_phone ?? "";
  const canSendWhatsapp = ticket.status === "pending" || ticket.status === "waiting";
  const canApprove = ["pending", "waiting"].includes(ticket.status);

  const handleWhatsapp = async () => {
    setBusy("whatsapp");
    try {
      const result = await AgendaService.sendWhatsappValidation(ticket.id);
      if (result.wa_me_url && !result.sent) {
        window.open(result.wa_me_url, "_blank", "noopener,noreferrer");
        toast.info("Abre WhatsApp para enviar el mensaje; la cita quedó en espera de confirmación.");
      } else {
        toast.success("Mensaje de validación enviado por WhatsApp.");
      }
      const refreshed = await AgendaService.getAppointment(ticket.id);
      onTicketUpdated(refreshed);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo enviar el WhatsApp."));
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = async () => {
    setBusy("approve");
    try {
      const updated = await AgendaService.approveValidation(ticket.id);
      onTicketUpdated(updated);
      toast.success("Cita aprobada y validada.");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo aprobar la cita."));
    } finally {
      setBusy(null);
    }
  };

  const serviceLabel = ticket.service_name ?? ticket.service_names?.join(", ") ?? "—";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{ticket.client_name}</p>
          <p className="text-xs text-slate-500">{formatSlot(ticket.start_time)}</p>
          <p className="mt-1 text-xs text-slate-600">{serviceLabel}</p>
          <p className="text-[11px] text-slate-400">
            {ticket.ticket_code ? `Ticket ${ticket.ticket_code}` : `#${ticket.id}`}
            {phone ? ` · ${phone}` : " · Sin teléfono"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(ticket.status)}`}
        >
          {ticket.status === "confirmed"
            ? "Aprobado"
            : ticket.status === "waiting"
              ? "WhatsApp enviado"
              : "Pendiente"}
        </span>
      </div>

      {ticket.status !== "confirmed" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canSendWhatsapp ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              disabled={busy !== null || !phone}
              onClick={() => void handleWhatsapp()}
              title={!phone ? "La clienta no tiene teléfono" : "Enviar validación por WhatsApp"}
            >
              <Send className="h-3.5 w-3.5" />
              {busy === "whatsapp" ? "Enviando…" : "WhatsApp"}
            </Button>
          ) : null}
          {canApprove ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              disabled={busy !== null}
              onClick={() => void handleApprove()}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {busy === "approve" ? "Aprobando…" : "Aprobar cita"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Section({
  title,
  description,
  tickets,
  emptyText,
  onTicketUpdated,
}: {
  title: string;
  description: string;
  tickets: TicketItem[];
  emptyText: string;
  onTicketUpdated: (ticket: TicketItem) => void;
}) {
  return (
    <section className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <p className="text-[11px] text-slate-500">{description}</p>
        <p className="mt-1 text-xs font-semibold text-[#094732]">{tickets.length} cita(s)</p>
      </div>
      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-8 text-center text-xs text-slate-400">
          {emptyText}
        </p>
      ) : (
        <div className="max-h-[min(52vh,640px)] space-y-2 overflow-y-auto pr-1">
          {tickets.map((ticket) => (
            <ValidationTicketRow key={ticket.id} ticket={ticket} onTicketUpdated={onTicketUpdated} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function WhatsAppValidationPanel({
  tickets,
  branchLabel,
  selectedDate,
  onTicketUpdated,
}: Props) {
  const dayTickets = tickets.filter((t) => {
    const d = parseTicketDate(t.start_time);
    if (Number.isNaN(d.getTime())) return false;
    const key = d.toISOString().slice(0, 10);
    return key === selectedDate && t.status !== "cancelled" && t.status !== "cancelado";
  });

  const pending = dayTickets.filter((t) => t.status === "pending");
  const waiting = dayTickets.filter((t) => t.status === "waiting");
  const confirmed = dayTickets.filter((t) => t.status === "confirmed");

  const handlePatch = (updated: TicketItem) => {
    onTicketUpdated(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div className="min-w-0 text-xs text-emerald-900">
          <p className="font-semibold">Validación por WhatsApp · {branchLabel}</p>
          <p className="mt-0.5 text-emerald-800/90">
            Envía el mensaje de confirmación a cada clienta. Las citas pasan a &quot;WhatsApp enviado&quot; y al
            aprobar quedan en la sección de aprobadas.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Section
          title="Pendientes"
          description="Aún no se envió WhatsApp de validación."
          tickets={pending}
          emptyText="No hay citas pendientes este día."
          onTicketUpdated={handlePatch}
        />
        <Section
          title="WhatsApp enviados"
          description="Mensaje enviado; falta aprobar la cita."
          tickets={waiting}
          emptyText="Ninguna cita esperando aprobación."
          onTicketUpdated={handlePatch}
        />
        <Section
          title="Aprobados"
          description="Citas validadas y confirmadas."
          tickets={confirmed}
          emptyText="Aún no hay citas aprobadas este día."
          onTicketUpdated={handlePatch}
        />
      </div>
    </div>
  );
}
