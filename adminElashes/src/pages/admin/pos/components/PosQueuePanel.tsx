import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, UserCheck, Users } from "lucide-react";
import SectionCard from "@/components/common/ui/SectionCard";
import type { TicketItem, ProfessionalForSelect } from "../../../../core/services/agenda/agenda.service";

type Props = {
  existingTickets: TicketItem[];
  professionals: ProfessionalForSelect[];
  todayStr: string;
};

const STATUS_CONFIG = {
  pending: { label: "En espera", bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-400" },
  in_service: { label: "En servicio", bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
} as const;

export default function PosQueuePanel({ existingTickets, professionals, todayStr }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const queueTickets = existingTickets.filter(
    (t) =>
      (t.status === "pending" || t.status === "in_service") &&
      t.start_time.slice(0, 10) === todayStr
  ).sort((a, b) => {
    // En servicio primero, luego por hora
    if (a.status === "in_service" && b.status !== "in_service") return -1;
    if (b.status === "in_service" && a.status !== "in_service") return 1;
    return a.start_time.localeCompare(b.start_time);
  });

  const inServiceCount = queueTickets.filter((t) => t.status === "in_service").length;
  const pendingCount = queueTickets.filter((t) => t.status === "pending").length;

  const resolveProfName = (ticket: TicketItem) => {
    if (ticket.professional_name) return ticket.professional_name;
    return professionals.find((p) => p.id === ticket.professional_id)?.username ?? "—";
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  if (queueTickets.length === 0) return null;

  const toggleActions = (
    <button
      type="button"
      onClick={() => setIsExpanded((v) => !v)}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-[#605e5c] hover:text-[#094732]"
    >
      {inServiceCount > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
          <UserCheck className="h-3 w-3" /> {inServiceCount}
        </span>
      )}
      {pendingCount > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
          <Clock className="h-3 w-3" /> {pendingCount}
        </span>
      )}
      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  return (
    <SectionCard
      variant="business"
      title="Cola de atención"
      actions={toggleActions}
      className="shrink-0 rounded-none border-x-0 border-t-0"
      bodyClassName={isExpanded ? "!p-0" : "hidden"}
    >
      <div className="max-h-52 overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#faf9f8] text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
              <th className="px-3 py-1.5">Clienta</th>
              <th className="px-3 py-1.5">Servicio</th>
              <th className="px-3 py-1.5">Operaria</th>
              <th className="px-3 py-1.5">Hora</th>
              <th className="px-3 py-1.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f2f1]">
            {queueTickets.map((ticket) => {
              const cfg = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
              return (
                <tr key={ticket.id} className="hover:bg-[#f3f2f1]">
                  <td className="max-w-30 truncate px-3 py-2 font-medium text-[#323130]">{ticket.client_name}</td>
                  <td className="max-w-35 truncate px-3 py-2 text-[#605e5c]">
                    {ticket.service_names?.join(", ") ?? ticket.service_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[#605e5c]">{resolveProfName(ticket)}</td>
                  <td className="px-3 py-2 font-mono text-[#323130]">{formatTime(ticket.start_time)}</td>
                  <td className="px-3 py-2">
                    {cfg ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    ) : (
                      <span className="text-[#a19f9d]">{ticket.status}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
