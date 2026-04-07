import { useEffect, useMemo, useState } from "react";
import { AgendaService, type TicketItem } from "@/core/services/agenda/agenda.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "@/core/utils/branch";

import { todayDate } from "./control.constants";

export default function TurnScreen() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(() => getSelectedBranchId());

  const loadTurns = async () => {
    const today = todayDate();
    const data = await AgendaService.listTickets({
      limit: 200,
      branch_id: activeBranchId ?? undefined,
      start_date: today,
      end_date: today,
    });
    setTickets(data);
  };

  useEffect(() => {
    void loadTurns();
    const interval = window.setInterval(loadTurns, 10000);
    return () => window.clearInterval(interval);
  }, [activeBranchId]);

  useEffect(() => {
    const handleChange = () => setActiveBranchId(getSelectedBranchId());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCH_STORAGE_KEY) {
        handleChange();
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("branchchange", handleChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("branchchange", handleChange);
    };
  }, []);

  const nowServing = useMemo(() => tickets.filter((ticket) => ticket.status === "in_service"), [tickets]);
  const waiting = useMemo(() => tickets.filter((ticket) => ["pending", "confirmed"].includes(ticket.status)), [tickets]);

  return (
    <div className="min-h-screen w-full bg-[#0E1F1A] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black uppercase tracking-widest text-emerald-200">Turnos de atencion</h1>
          <p className="text-emerald-300/80">Pantalla publica de llamados</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-800/60 bg-emerald-900/20 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Ahora atendiendo</h2>
            <div className="mt-6 space-y-6">
              {nowServing.length === 0 ? (
                <p className="text-emerald-200/80">Sin turnos en servicio.</p>
              ) : (
                nowServing.slice(0, 3).map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl bg-emerald-900/50 p-5">
                    <p className="text-4xl font-black text-white">{ticket.ticket_code ?? `#${ticket.id}`}</p>
                    <p className="mt-2 text-emerald-200">{ticket.client_name}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-800/60 bg-emerald-900/20 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">En espera</h2>
            <div className="mt-6 grid gap-4">
              {waiting.length === 0 ? (
                <p className="text-emerald-200/80">Sin turnos en espera.</p>
              ) : (
                waiting.slice(0, 6).map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-2xl bg-emerald-900/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-lg font-bold text-white">{ticket.ticket_code ?? `#${ticket.id}`}</p>
                      <p className="text-xs text-emerald-200">{ticket.client_name}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-300">Turno {index + 1}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
