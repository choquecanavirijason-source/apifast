import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../../../../components/common/ui";
import {
  AgendaService,
  type AppointmentCreatePayload,
  type ClientForSelect,
  type ProfessionalForSelect,
  type ServiceOption,
} from "../../../../core/services/agenda/agenda.service";
import { getApiErrorMessage } from "../../../../core/utils/apiError";
import { agendaFieldClass, agendaLabelClass } from "../dailyAgenda.constants";
import type { ResCartLine } from "../dailyAgenda.types";
import { formatLocalDateTime, newLocalId } from "../dailyAgenda.utils";

export type ReservationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  branchId: number | null;
  services: ServiceOption[];
  professionals: ProfessionalForSelect[];
  selectedDate: string;
  initialTime: string;
  initialProfessionalId: number | null;
  registeredClient: ClientForSelect | null;
  onConsumeRegisteredClient: () => void;
  onOpenRegisterClient: () => void;
};

export default function ReservationDrawer({
  isOpen,
  onClose,
  onSaved,
  branchId,
  services,
  professionals,
  selectedDate,
  initialTime,
  initialProfessionalId,
  registeredClient,
  onConsumeRegisteredClient,
  onOpenRegisterClient,
}: ReservationDrawerProps) {
  const [cartLines, setCartLines] = useState<ResCartLine[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientForSelect | null>(null);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [filteredClients, setFilteredClients] = useState<ClientForSelect[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [professionalId, setProfessionalId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
  const filteredServices = useMemo(() => {
    if (!normalizedServiceQuery) return services.slice(0, 14);
    return services
      .filter((service) => service.name.toLowerCase().includes(normalizedServiceQuery))
      .slice(0, 14);
  }, [normalizedServiceQuery, services]);

  const cartCount = cartLines.length;

  useEffect(() => {
    if (!isOpen) return;
    setStartTime(initialTime);
    setProfessionalId(initialProfessionalId != null ? String(initialProfessionalId) : "");
    setSelectedClient(null);
    setClientSearch("");
    setFilteredClients([]);
    setCartLines([]);
    setServiceQuery("");
    setIsServiceMenuOpen(false);
    setIsClientMenuOpen(false);
    setDurationMinutes(60);
  }, [isOpen, initialTime, initialProfessionalId]);

  useEffect(() => {
    if (!registeredClient) return;
    setSelectedClient(registeredClient);
    setClientSearch("");
    setIsClientMenuOpen(false);
    onConsumeRegisteredClient();
  }, [registeredClient, onConsumeRegisteredClient]);

  useEffect(() => {
    if (!isOpen || clientSearch.trim().length < 2) {
      setFilteredClients([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setIsSearchingClients(true);
      try {
        const list = await AgendaService.listClientsForSelect({
          search: clientSearch.trim(),
          limit: 25,
          branch_id: branchId ?? undefined,
        });
        setFilteredClients(list);
      } catch {
        setFilteredClients([]);
      } finally {
        setIsSearchingClients(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [clientSearch, isOpen, branchId]);

  useEffect(() => {
    if (cartLines.length === 0) return;
    const total = cartLines.reduce((acc, line) => {
      const s = services.find((x) => x.id === line.service_id);
      return acc + (s?.duration_minutes ?? 0);
    }, 0);
    if (total > 0) setDurationMinutes(total);
  }, [cartLines, services]);

  const addServiceById = (serviceId: string) => {
    const id = Number(serviceId);
    if (!Number.isFinite(id)) return;
    setCartLines((prev) => [...prev, { localId: newLocalId(), service_id: id }]);
  };

  const removeLine = (localId: string) => {
    setCartLines((prev) => prev.filter((l) => l.localId !== localId));
  };

  const changeLineService = (localId: string, serviceId: string) => {
    const id = Number(serviceId);
    if (!Number.isFinite(id)) return;
    setCartLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, service_id: id } : l)));
  };

  const dateLabel = useMemo(() => {
    try {
      return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-BO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast.warning("Selecciona una clienta.");
      return;
    }
    if (!branchId) {
      toast.warning("Selecciona sucursal en la barra superior.");
      return;
    }

    const start = new Date(`${selectedDate}T${startTime || "09:00"}:00`);
    const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60 * 1000);
    if (end <= start) {
      toast.warning("Revisa la duración.");
      return;
    }

    const ids = cartLines.map((l) => l.service_id).filter((n) => Number.isFinite(n));
    const payload: AppointmentCreatePayload = {
      client_id: selectedClient.id,
      branch_id: branchId,
      start_time: formatLocalDateTime(start),
      end_time: formatLocalDateTime(end),
      status: "pending",
      ...(professionalId ? { professional_id: Number(professionalId) } : { professional_id: null }),
      ...(ids.length ? { service_ids: ids } : {}),
    };

    setIsSubmitting(true);
    try {
      await AgendaService.createAppointment(payload);
      toast.success("Reserva registrada.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la reserva."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[48] bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Cerrar reserva"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[49] flex h-full max-h-[100dvh] w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="reservation-drawer-title" className="text-base font-semibold text-slate-800">
              Nueva reserva
            </p>
            <p className="truncate text-xs text-slate-500">
              Servicios + clienta. Solo reserva — <span className="font-semibold text-[#094732]">sin cobro</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-[#094732]" />
                <span className="text-sm font-semibold text-slate-800">Servicios ({cartCount})</span>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="space-y-1.5">
                <label className={agendaLabelClass}>Agregar servicio</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={serviceQuery}
                    onChange={(event) => {
                      setServiceQuery(event.target.value);
                      setIsServiceMenuOpen(true);
                    }}
                    onFocus={() => setIsServiceMenuOpen(true)}
                    placeholder="Buscar servicio…"
                    className={`${agendaFieldClass} pl-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsServiceMenuOpen((c) => !c)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                    aria-label="Lista de servicios"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {isServiceMenuOpen ? (
                    <div className="absolute z-[52] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="max-h-56 overflow-y-auto py-1">
                        {filteredServices.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-400">No se encontraron servicios.</p>
                        ) : (
                          filteredServices.map((service) => (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => {
                                addServiceById(String(service.id));
                                setServiceQuery("");
                                setIsServiceMenuOpen(false);
                              }}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                            >
                              <span className="truncate text-slate-700">{service.name}</span>
                              <span className="shrink-0 text-xs font-medium text-slate-500">{service.duration_minutes} min</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {cartCount === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm italic text-slate-400">
                  Opcional: agrega servicios o define duración abajo.
                </p>
              ) : (
                <div className="space-y-2">
                  {cartLines.map((line) => {
                    const svc = services.find((s) => s.id === line.service_id);
                    return (
                      <div
                        key={line.localId}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
                      >
                        <select
                          value={line.service_id}
                          onChange={(event) => changeLineService(line.localId, event.target.value)}
                          className={`${agendaFieldClass} min-w-0 flex-1`}
                        >
                          <option value="">Servicio…</option>
                          {services.map((service) => (
                            <option key={service.id} value={service.id}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                        <span className="shrink-0 text-xs font-medium text-slate-500">
                          {svc ? `${svc.duration_minutes} min` : "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.localId)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-800">Datos de la reserva</p>
                <p className="text-xs text-slate-500">
                  Fecha: <span className="font-medium text-slate-700">{dateLabel}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={agendaLabelClass}>Clienta *</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={selectedClient ? `${selectedClient.nombre} ${selectedClient.apellido}`.trim() : clientSearch}
                      onChange={(event) => {
                        setSelectedClient(null);
                        setClientSearch(event.target.value);
                        setIsClientMenuOpen(true);
                      }}
                      onFocus={() => setIsClientMenuOpen(true)}
                      placeholder="Nombre, apellido o teléfono…"
                      className={`${agendaFieldClass} pl-9`}
                      disabled={Boolean(selectedClient)}
                    />
                    {!selectedClient && isClientMenuOpen ? (
                      <div className="absolute z-[52] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="max-h-56 overflow-y-auto py-1">
                          {isSearchingClients ? (
                            <p className="px-3 py-2 text-xs text-slate-400">Buscando…</p>
                          ) : filteredClients.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-400">Escribe al menos 2 caracteres.</p>
                          ) : (
                            filteredClients.map((client) => {
                              const fullName = `${client.nombre} ${client.apellido}`.trim();
                              return (
                                <button
                                  key={client.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedClient(client);
                                    setClientSearch("");
                                    setIsClientMenuOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                                >
                                  <span className="truncate text-slate-700">{fullName}</span>
                                  <span className="ml-3 shrink-0 text-xs text-slate-500">{client.phone || "—"}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={onOpenRegisterClient}
                    title="Registrar nueva clienta"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#094732] hover:text-[#094732]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {selectedClient ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#094732] hover:underline"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientSearch("");
                      setIsClientMenuOpen(false);
                    }}
                  >
                    Cambiar clienta
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={agendaLabelClass} htmlFor="res-time">
                    Hora de inicio
                  </label>
                  <input
                    id="res-time"
                    type="time"
                    step={300}
                    value={startTime}
                    onChange={(ev) => setStartTime(ev.target.value)}
                    className={agendaFieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={agendaLabelClass} htmlFor="res-duration">
                    Duración (min)
                  </label>
                  <input
                    id="res-duration"
                    type="number"
                    min={15}
                    step={5}
                    value={durationMinutes}
                    onChange={(ev) => setDurationMinutes(Number(ev.target.value))}
                    className={agendaFieldClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={agendaLabelClass} htmlFor="res-pro">
                  Operaria / puesto
                </label>
                <select
                  id="res-pro"
                  value={professionalId}
                  onChange={(ev) => setProfessionalId(ev.target.value)}
                  className={`${agendaFieldClass} cursor-pointer`}
                >
                  <option value="">Sin asignar</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
            <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center">
              <span className="text-xs font-semibold text-[#094732]">Solo reserva en agenda</span>
              <p className="mt-0.5 text-[11px] text-slate-500">No se registra monto ni pago aquí.</p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Confirmar reserva"}
            </Button>
            <Button type="button" variant="secondary" className="mt-2 w-full" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
