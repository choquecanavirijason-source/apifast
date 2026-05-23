import { useNavigate } from "react-router-dom";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { clientPhoneOrRef, ticketCardClass } from "../dailyAgenda.utils";

type AgendaTicketCardProps = {
  ticket: TicketItem;
  compact?: boolean;
};

function clientStatusLabel(status?: string | null): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    en_espera: "En espera",
    en_servicio: "En servicio",
    pagado: "Pagado",
    reserva: "Reserva",
    finalizado: "Finalizado",
    sin_estado: "Sin estado",
    cancelado: "Cancelado",
  };
  return map[status.toLowerCase()] ?? status;
}

function InfoRow({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  if (!value || value === "—") return null;
  return (
    <div className={`flex gap-1 leading-snug ${compact ? "text-[9px]" : "text-[10px]"}`}>
      <span className="shrink-0 font-semibold text-[#605e5c]">{label}:</span>
      <span className="min-w-0 truncate text-[#323130]">{value}</span>
    </div>
  );
}

export default function AgendaTicketCard({ ticket, compact = false }: AgendaTicketCardProps) {
  const navigate = useNavigate();
  const client = ticket.client;
  const nameParts = ticket.client_name.trim().split(/\s+/).filter(Boolean);
  const nombre = client?.name ?? nameParts[0] ?? ticket.client_name;
  const apellido = client?.last_name ?? (nameParts.slice(1).join(" ") || "—");
  const phone = clientPhoneOrRef(ticket);
  const age = client?.age ?? ticket.client_age;
  const eyeType = client?.eye_type_name ?? ticket.client_eye_type_name;
  const branch = client?.branch_name ?? ticket.client_branch_name;
  const clientStatus = client?.status ?? ticket.client_status;
  const serviceLabel =
    ticket.service_name ?? ticket.service_names?.join(", ") ?? "Sin servicio";

  const textSize = compact ? "text-[10px]" : "text-[11px]";
  const padding = compact ? "p-1.5" : "p-2";
  const minWidth = compact ? "min-w-[128px]" : "min-w-[148px]";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`${minWidth} max-w-[200px] shrink-0 rounded-md border-2 text-left shadow-sm ${padding} ${ticketCardClass(
        ticket.status
      )}`}
    >
      <div className={`truncate font-bold leading-tight text-[#004578] ${compact ? "text-[10px]" : "text-xs"}`}>
        {nombre} {apellido}
      </div>

      <div className={`mt-1 space-y-0.5 ${textSize}`}>
        <InfoRow label="Tel" value={phone} compact={compact} />
        <InfoRow label="Edad" value={age != null ? String(age) : ""} compact={compact} />
        <InfoRow label="Ojos" value={eyeType ?? ""} compact={compact} />
        <InfoRow label="Sucursal" value={branch ?? ""} compact={compact} />
        <InfoRow label="Estado" value={clientStatusLabel(clientStatus)} compact={compact} />
        <InfoRow label="ID" value={`#${ticket.client_id}`} compact={compact} />
      </div>

      <div
        className={`mt-1.5 border-t border-current/15 pt-1 leading-snug opacity-90 ${compact ? "text-[9px]" : "text-[10px]"}`}
      >
        {ticket.ticket_code ? <div className="truncate font-medium">Ticket: {ticket.ticket_code}</div> : null}
        <div className="truncate">{serviceLabel}</div>
        {ticket.professional_name ? (
          <div className="truncate">Operaria: {ticket.professional_name}</div>
        ) : null}
        <div className="truncate capitalize">Reserva: {ticket.status}</div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {!ticket.sale_id ? (
          <button
            type="button"
            className={`rounded border border-[#0078d4]/40 bg-white font-semibold text-[#0078d4] hover:bg-[#deecf9] ${
              compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/admin/pos", {
                state: { fromAgendaReservation: { appointmentId: ticket.id } },
              });
            }}
          >
            {compact ? "Venta" : "Pasar a venta"}
          </button>
        ) : (
          <span className={`font-semibold text-emerald-800 ${compact ? "text-[8px]" : "text-[9px]"}`}>
            Venta #{ticket.sale_id}
          </span>
        )}
      </div>
    </div>
  );
}
