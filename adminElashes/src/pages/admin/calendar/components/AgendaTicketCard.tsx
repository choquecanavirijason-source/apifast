import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Phone, Eye, MapPin, User, Tag } from "lucide-react";
import type { TicketItem } from "../../../../core/services/agenda/agenda.service";
import { clientPhoneOrRef, ticketCardClass } from "../dailyAgenda.utils";

type AgendaTicketCardProps = {
  ticket: TicketItem;
  compact?: boolean;
};


function DetailRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-center gap-1 text-[9px] leading-snug">
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

export default function AgendaTicketCard({ ticket, compact = false }: AgendaTicketCardProps) {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);

  const client = ticket.client;
  const nameParts = ticket.client_name.trim().split(/\s+/).filter(Boolean);
  const nombre = client?.name ?? nameParts[0] ?? ticket.client_name;
  const apellido = client?.last_name ?? (nameParts.slice(1).join(" ") || "");
  const phone = clientPhoneOrRef(ticket);
  const age = client?.age ?? ticket.client_age;
  const eyeType = client?.eye_type_name ?? ticket.client_eye_type_name;
  const branch = client?.branch_name ?? ticket.client_branch_name;

  const primaryService =
    ticket.service_names?.[0] ?? ticket.service_name ?? "Sin servicio";
  const extraCount = (ticket.service_names?.length ?? 0) > 1
    ? ticket.service_names!.length - 1
    : 0;

  const padding = compact ? "p-0.5" : "p-1";
  const minWidth = compact ? "min-w-[96px]" : "min-w-[112px]";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`${minWidth} max-w-[200px] shrink-0 rounded-md border-2 text-left shadow-sm ${padding} ${ticketCardClass(ticket.status)}`}
    >
      {/* ── Info mínima ─────────────────────────────────────────────────── */}
      <div className="cursor-pointer" onClick={() => setDetailOpen((v) => !v)}>
        {/* Nombre — solo primer nombre */}
        <div className={`truncate font-bold leading-tight text-[#004578] ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {nombre}
        </div>

        {/* Servicio principal */}
        <div className="flex items-center gap-0.5">
          <span className={`truncate text-[#323130] ${compact ? "text-[8px]" : "text-[9px]"}`}>
            {primaryService}
          </span>
          {extraCount > 0 && (
            <span className="shrink-0 rounded bg-current/10 px-0.5 text-[7px] font-bold">+{extraCount}</span>
          )}
        </div>

        {/* Toggle detalles — solo chevron */}
        <div className="flex items-center gap-0.5 opacity-40">
          {detailOpen ? <ChevronUp size={7} /> : <ChevronDown size={7} />}
        </div>
      </div>

      {/* ── Panel de detalles ─────────────────────────────────────────── */}
      {detailOpen && (
        <div className="mt-1.5 space-y-0.5 border-t border-current/20 pt-1.5">
          {ticket.ticket_code && (
            <DetailRow icon={<Tag size={8} />} value={ticket.ticket_code} />
          )}
          {phone && (
            <DetailRow icon={<Phone size={8} />} value={phone} />
          )}
          {age != null && (
            <DetailRow icon={<User size={8} />} value={`${age} años`} />
          )}
          {eyeType && (
            <DetailRow icon={<Eye size={8} />} value={eyeType} />
          )}
          {branch && (
            <DetailRow icon={<MapPin size={8} />} value={branch} />
          )}
          {ticket.professional_name && (
            <DetailRow icon={<User size={8} />} value={`Op: ${ticket.professional_name}`} />
          )}
          {(ticket.service_names?.length ?? 0) > 1 && (
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {ticket.service_names!.map((s, i) => (
                <span key={i} className="rounded bg-current/10 px-0.5 text-[8px] font-semibold">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Botón pasar a venta ───────────────────────────────────────── */}
      <div className="mt-1.5 border-t border-current/15 pt-1">
        {!ticket.sale_id ? (
          <button
            type="button"
            className={`rounded border border-[#0078d4]/40 bg-white font-semibold text-[#0078d4] hover:bg-[#deecf9] ${
              compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              navigate("/admin/pos-tracking", {
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
