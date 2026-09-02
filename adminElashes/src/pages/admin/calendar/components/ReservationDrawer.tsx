import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, ChevronDown, Info, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../../../../components/common/ui";
import {
  AgendaService,
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
  openingHoursToday?: Array<{ open_time: string; close_time: string }> | null;
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
  openingHoursToday,
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

  // Adelanto — true forzado si el cliente es nuevo (recién registrado)
  const [isNewClient, setIsNewClient] = useState(false);
  const [advanceEnabled, setAdvanceEnabled] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");

  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
  const filteredServices = useMemo(() => {
    if (!normalizedServiceQuery) return services.slice(0, 14);
    return services
      .filter((service) => service.name.toLowerCase().includes(normalizedServiceQuery))
      .slice(0, 14);
  }, [normalizedServiceQuery, services]);

  const cartCount = cartLines.length;

  const formatTimeHm = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  /** Un ticket por servicio; horarios encadenados desde la hora de inicio. */
  const consecutiveSlots = useMemo(() => {
    if (cartLines.length === 0) return [];
    let cursor = new Date(`${selectedDate}T${startTime || "09:00"}:00`);
    return cartLines.map((line) => {
      const svc = services.find((s) => s.id === line.service_id);
      const mins = Math.max(15, svc?.duration_minutes ?? 60);
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + mins * 60_000);
      const slot = {
        line,
        serviceName: svc?.name ?? "Servicio",
        slotStart,
        slotEnd,
        timeLabel: `${formatTimeHm(slotStart)} – ${formatTimeHm(slotEnd)}`,
        durationMinutes: mins,
      };
      cursor = slotEnd;
      return slot;
    });
  }, [cartLines, services, selectedDate, startTime]);

  const branchProfessionals = useMemo(() => {
    if (!branchId) return [];
    return professionals.filter((p) => p.branch_id == null || Number(p.branch_id) === branchId);
  }, [branchId, professionals]);

  const hoursLabel = useMemo(() => {
    if (!openingHoursToday || openingHoursToday.length === 0) return null;
    return openingHoursToday.map((r) => `${r.open_time}–${r.close_time}`).join("  /  ");
  }, [openingHoursToday]);

  const startTimeWarning = useMemo(() => {
    if (!openingHoursToday || openingHoursToday.length === 0 || !startTime) return null;
    const [h, m] = startTime.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const fits = openingHoursToday.some((r) => {
      const [oh, om] = r.open_time.split(":").map(Number);
      const [ch, cm] = r.close_time.split(":").map(Number);
      return startMinutes >= oh * 60 + om && startMinutes < ch * 60 + cm;
    });
    return fits ? null : `Fuera del horario del salón (${hoursLabel})`;
  }, [openingHoursToday, startTime, hoursLabel]);

  useEffect(() => {
    if (!professionalId) return;
    if (!branchProfessionals.some((p) => String(p.id) === professionalId)) {
      setProfessionalId("");
    }
  }, [branchProfessionals, professionalId]);

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
    setIsNewClient(false);
    setAdvanceEnabled(false);
    setAdvanceAmount("");
  }, [isOpen, initialTime, initialProfessionalId]);

  useEffect(() => {
    if (!registeredClient) return;
    setSelectedClient(registeredClient);
    setClientSearch("");
    setIsClientMenuOpen(false);
    onConsumeRegisteredClient();
    // Cliente recién registrado → adelanto obligatorio
    setIsNewClient(true);
    setAdvanceEnabled(true);
    setAdvanceAmount("");
  }, [registeredClient, onConsumeRegisteredClient]);

  useEffect(() => {
    setSelectedClient(null);
    setClientSearch("");
    setFilteredClients([]);
    setIsClientMenuOpen(false);
  }, [branchId]);

  const loadBranchClients = useCallback(
    async (search?: string) => {
      if (!branchId) {
        setFilteredClients([]);
        return;
      }
      setIsSearchingClients(true);
      try {
        const list = await AgendaService.listClientsForSelect({
          search: search?.trim() || undefined,
          limit: 50,
          branch_id: branchId,
        });
        setFilteredClients(list);
      } catch {
        setFilteredClients([]);
      } finally {
        setIsSearchingClients(false);
      }
    },
    [branchId]
  );

  useEffect(() => {
    if (!isOpen || !branchId || selectedClient || !isClientMenuOpen) {
      if (!branchId) setFilteredClients([]);
      return;
    }

    const query = clientSearch.trim();
    if (query.length === 1) {
      setFilteredClients([]);
      return;
    }

    const t = window.setTimeout(() => {
      void loadBranchClients(query.length >= 2 ? query : undefined);
    }, query.length >= 2 ? 300 : 0);

    return () => window.clearTimeout(t);
  }, [clientSearch, isOpen, branchId, isClientMenuOpen, selectedClient, loadBranchClients]);

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

    const parsedAdvance = parseFloat(advanceAmount) || 0;
    if (isNewClient && parsedAdvance <= 0) {
      toast.warning("El cliente es nuevo — se requiere un monto de adelanto para confirmar la reserva.");
      return;
    }

    const professional_id = professionalId ? Number(professionalId) : null;
    const base = {
      client_id: selectedClient.id,
      branch_id: branchId,
      status: "pending" as const,
      professional_id,
      advance_payment_amount: advanceEnabled ? parsedAdvance : 0,
    };

    setIsSubmitting(true);
    try {
      if (cartLines.length === 0) {
        const start = new Date(`${selectedDate}T${startTime || "09:00"}:00`);
        const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60 * 1000);
        if (end <= start) {
          toast.warning("Revisa la duración.");
          return;
        }
        await AgendaService.createAppointment({
          ...base,
          start_time: formatLocalDateTime(start),
          end_time: formatLocalDateTime(end),
        });
        toast.success("Reserva registrada (1 ticket).");
      } else {
        if (consecutiveSlots.length === 0) {
          toast.warning("Agrega al menos un servicio.");
          return;
        }

        const sale = await AgendaService.createReservationSale({
          client_id: selectedClient.id,
          branch_id: branchId,
          professional_id,
          advance_payment_amount: advanceEnabled ? parsedAdvance : 0,
          items: consecutiveSlots.map((slot) => ({
            service_id: slot.line.service_id,
            professional_id,
            start_time: formatLocalDateTime(slot.slotStart),
            end_time: formatLocalDateTime(slot.slotEnd),
          })),
        });

        const ticketCount = sale.appointments?.length ?? consecutiveSlots.length;
        toast.success(
          `Reserva unificada ${sale.sale_code}: ${ticketCount} ticket${ticketCount !== 1 ? "s" : ""} (misma venta, horarios en fila).`
        );
      }

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
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-[#094732]" />
                  <span className="text-sm font-semibold text-slate-800">Servicios ({cartCount})</span>
                </div>
                {cartCount > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Una sola venta/reserva: cada servicio es un ticket con su hora; todos quedan bajo el mismo código de venta.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div data-tour="agenda-res-services" className="space-y-1.5">
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
                  {consecutiveSlots.map((slot, index) => {
                    const { line, serviceName, timeLabel, durationMinutes: slotMins } = slot;
                    return (
                      <div
                        key={line.localId}
                        className="rounded-xl border border-slate-200 bg-white p-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-[#094732]">
                          <span>Ticket {index + 1}</span>
                          <span className="font-mono normal-case text-slate-600">{timeLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
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
                        <span className="shrink-0 text-xs font-medium text-slate-500" title={serviceName}>
                          {slotMins} min
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
                {hoursLabel ? (
                  <p className="mt-1 text-xs text-[#094732]">
                    Horario del salón: <span className="font-semibold">{hoursLabel}</span>
                  </p>
                ) : null}
              </div>

              <div data-tour="agenda-res-client" className="space-y-1.5">
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
                      onFocus={() => {
                        if (!branchId) return;
                        setIsClientMenuOpen(true);
                        if (!clientSearch.trim()) void loadBranchClients();
                      }}
                      placeholder={
                        !branchId ? "Selecciona sucursal arriba" : "Nombre, apellido o teléfono…"
                      }
                      className={`${agendaFieldClass} pl-9`}
                      disabled={Boolean(selectedClient) || !branchId}
                    />
                    {!selectedClient && isClientMenuOpen && branchId ? (
                      <div className="absolute z-[52] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        <div className="max-h-56 overflow-y-auto py-1">
                          {isSearchingClients ? (
                            <p className="px-3 py-2 text-xs text-slate-400">Buscando…</p>
                          ) : clientSearch.trim().length === 1 ? (
                            <p className="px-3 py-2 text-xs text-slate-400">Escribe al menos 2 caracteres.</p>
                          ) : filteredClients.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-slate-400">
                              {clientSearch.trim().length >= 2
                                ? "No hay clientas en esta sucursal."
                                : "Sin clientas en esta sucursal."}
                            </p>
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
                                    // Cliente existente → adelanto opcional, no forzado
                                    setIsNewClient(false);
                                    setAdvanceEnabled(false);
                                    setAdvanceAmount("");
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

              <div data-tour="agenda-res-time" className="grid grid-cols-2 gap-3">
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
                    className={`${agendaFieldClass} ${startTimeWarning ? "border-amber-400 focus:border-amber-500 focus:ring-amber-400/30" : ""}`}
                  />
                  {startTimeWarning ? (
                    <p className="text-[11px] font-medium text-amber-600">{startTimeWarning}</p>
                  ) : null}
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
                    disabled={cartCount > 0}
                    title={
                      cartCount > 0
                        ? "Con servicios en la lista, la duración total se calcula por ticket"
                        : undefined
                    }
                    className={agendaFieldClass}
                  />
                </div>
              </div>

              <div data-tour="agenda-res-pro" className="space-y-1.5">
                <label className={agendaLabelClass} htmlFor="res-pro">
                  Operaria / puesto
                </label>
                <select
                  id="res-pro"
                  value={professionalId}
                  onChange={(ev) => setProfessionalId(ev.target.value)}
                  disabled={!branchId}
                  className={`${agendaFieldClass} cursor-pointer`}
                >
                  <option value="">
                    {!branchId ? "Selecciona sucursal arriba" : "Sin asignar"}
                  </option>
                  {branchProfessionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Adelanto ──────────────────────────────────────────────── */}
              {selectedClient && (
                <div className={`rounded-xl border p-3 ${
                  isNewClient
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}>
                  <div className="mb-2 flex items-start gap-2">
                    {isNewClient ? (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      {isNewClient ? (
                        <p className="text-xs font-semibold text-amber-800">
                          Cliente nuevo — adelanto obligatorio
                        </p>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={advanceEnabled}
                            onChange={(e) => {
                              setAdvanceEnabled(e.target.checked);
                              if (!e.target.checked) setAdvanceAmount("");
                            }}
                            className="rounded border-slate-300 text-[#094732] focus:ring-[#094732]"
                          />
                          Registrar adelanto
                        </label>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {isNewClient
                          ? "Para confirmar la reserva de una clienta nueva se requiere un pago anticipado."
                          : "Opcional: la clienta puede abonar un monto para asegurar su turno."}
                      </p>
                    </div>
                  </div>

                  {(isNewClient || advanceEnabled) && (
                    <div className="mt-2">
                      <label className={agendaLabelClass}>
                        Monto de adelanto (Bs) {isNewClient && <span className="text-red-500">*</span>}
                      </label>
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                          Bs
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(e.target.value)}
                          placeholder="0.00"
                          className={`${agendaFieldClass} pl-9 ${
                            isNewClient && (!advanceAmount || parseFloat(advanceAmount) <= 0)
                              ? "border-amber-400 focus:border-amber-500 focus:ring-amber-400/30"
                              : ""
                          }`}
                        />
                      </div>
                      {isNewClient && (!advanceAmount || parseFloat(advanceAmount) <= 0) && (
                        <p className="mt-1 text-[11px] font-medium text-amber-600">
                          Ingresa el monto para continuar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div data-tour="agenda-res-confirm" className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
            {!selectedClient || (!isNewClient && !advanceEnabled) ? (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-center">
                <span className="text-xs font-semibold text-[#094732]">Solo reserva en agenda</span>
                <p className="mt-0.5 text-[11px] text-slate-500">No se registra monto ni pago aquí.</p>
              </div>
            ) : (
              <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-center">
                <span className="text-xs font-semibold text-amber-800">
                  Adelanto: Bs {parseFloat(advanceAmount || "0").toFixed(2)}
                </span>
                <p className="mt-0.5 text-[11px] text-slate-500">Se registra el monto junto con la reserva.</p>
              </div>
            )}
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
