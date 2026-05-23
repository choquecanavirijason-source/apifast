import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Columns3, List, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import Layout from "../../../components/common/layout";
import { Button, SectionCard } from "../../../components/common/ui";
import RegisterClientModal from "../clients/RegisterClientModal";
import { ClientService } from "../../../core/services/client/client.service";
import type { EyeTypeOption } from "../../../core/services/client/client.service";
import { BranchService } from "../../../core/services/branch/branch.service";
import {
  AgendaService,
  type AppointmentCreatePayload,
  type ClientForSelect,
  type ProfessionalForSelect,
  type ServiceOption,
  type TicketItem,
} from "../../../core/services/agenda/agenda.service";
import { BRANCH_STORAGE_KEY, getSelectedBranchId } from "../../../core/utils/branch";
import { getApiErrorMessage } from "../../../core/utils/apiError";
import { getLocalDateInputValue } from "./calendar.utils";
import { parseDragTicketId, parseDropTarget, plannerDropId, stationDropId } from "./dailyAgenda.dnd";
import { buildRescheduleTimes } from "./dailyAgenda.utils";
import AgendaDropCell from "./components/AgendaDropCell";
import AgendaTicketCard from "./components/AgendaTicketCard";
import DraggableAgendaTicketCard from "./components/DraggableAgendaTicketCard";

const GRID_FIRST_HOUR = 9;
const GRID_LAST_HOUR = 20;
const STATION_COUNT = 8;

const AGENDA_VIEW_STORAGE_KEY = "daily-agenda-view-mode";

type AgendaViewMode = "planner" | "stations";

type PlannerSlot = { minuteOfDay: number; stepMinutes: number; label: string };

function buildPlannerSlots(): PlannerSlot[] {
  const slots: PlannerSlot[] = [];
  for (let h = 7; h <= 18; h += 1) {
    for (const m of [0, 15, 30, 45]) {
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 15,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  for (let h = 19; h <= 22; h += 1) {
    for (const m of [0, 30]) {
      if (h === 22 && m > 30) break;
      slots.push({
        minuteOfDay: h * 60 + m,
        stepMinutes: 30,
        label: new Date(2000, 0, 1, h, m).toLocaleTimeString("es-BO", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      });
    }
  }
  return slots;
}

const PLANNER_SLOTS = buildPlannerSlots();

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Semana calendario (lun–dom) que contiene `isoDate`. */
function buildWeekStrip(isoDate: string): string[] {
  const center = new Date(`${isoDate}T12:00:00`);
  const dow = center.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(center);
  monday.setDate(center.getDate() + toMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return toIsoDate(day);
  });
}

const parseTicketDate = (value: string) => {
  if (!value) return new Date("");
  const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTz) return new Date(value);
  const [datePart, timePartRaw = "00:00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePartRaw.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
};

const formatLocalDateTime = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
};

function slotKeyForTime(minuteOfDay: number, step: number) {
  return Math.floor(minuteOfDay / step) * step;
}

function groupTicketsByPlannerSlot(tickets: TicketItem[], dateKey: string): Map<number, TicketItem[]> {
  const map = new Map<number, TicketItem[]>();
  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime()) || toIsoDate(start) !== dateKey) continue;
    const mod = start.getHours() * 60 + start.getMinutes();
    let slotStart: number;
    if (mod >= 7 * 60 && mod < 19 * 60) {
      slotStart = slotKeyForTime(mod, 15);
    } else {
      slotStart = Math.max(19 * 60, slotKeyForTime(mod, 30));
    }
    const list = map.get(slotStart) ?? [];
    list.push(t);
    map.set(slotStart, list);
  }
  for (const [k, list] of map) {
    list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    map.set(k, list);
  }
  return map;
}

function groupTicketsByHourAndStation(
  tickets: TicketItem[],
  dateKey: string,
  professionals: ProfessionalForSelect[]
): Map<string, TicketItem[]> {
  const map = new Map<string, TicketItem[]>();
  const proIds = professionals.slice(0, STATION_COUNT).map((p) => p.id);

  for (const t of tickets) {
    const start = parseTicketDate(t.start_time);
    if (Number.isNaN(start.getTime()) || toIsoDate(start) !== dateKey) continue;
    const hour = start.getHours();
    if (hour < GRID_FIRST_HOUR || hour > GRID_LAST_HOUR) continue;
    const pid = t.professional_id;
    let col = 0;
    if (pid != null) {
      const idx = proIds.indexOf(pid);
      col = idx >= 0 ? Math.min(idx, STATION_COUNT - 1) : 0;
    }
    const key = `${hour}__${col}`;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

type ResCartLine = { localId: string; service_id: number };

function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Panel lateral estilo POS: misma idea que una venta (servicios + clienta), pero solo reserva — sin montos. */
function ReservationDrawer({
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
}: {
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
}) {
  const labelClass = "mb-1 block text-xs font-semibold text-[#605e5c]";
  const bcField =
    "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

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

  const branchProfessionals = useMemo(() => {
    if (!branchId) return [];
    return professionals.filter((p) => p.branch_id == null || Number(p.branch_id) === branchId);
  }, [branchId, professionals]);

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
        className="fixed inset-0 z-[48] bg-[#323130]/40 backdrop-blur-[1px]"
        aria-label="Cerrar reserva"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-[49] flex h-full max-h-[100dvh] w-full max-w-md flex-col border-l border-[#edebe9] bg-[#faf9f8] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-white px-4 py-3">
          <div className="min-w-0 pr-2">
            <p id="reservation-drawer-title" className="text-base font-semibold text-[#323130]">
              Nueva reserva
            </p>
            <p className="truncate text-xs text-[#605e5c]">
              Como una venta: servicios + clienta. Solo reserva —{" "}
              <span className="font-semibold text-[#004578]">sin cobro ni montos</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm p-2 text-[#605e5c] transition hover:bg-[#f3f2f1]"
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="border-b border-[#edebe9]">
              <div className="flex items-center gap-2 bg-[#faf9f8] px-4 py-3">
                <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
                <span className="text-sm font-semibold text-[#323130]">Servicios ({cartCount})</span>
              </div>
              <div className="border-b border-[#edebe9] bg-white px-4 py-3">
                <p className="mb-1 text-xs font-semibold uppercase text-[#605e5c]">Agregar servicio</p>
                <p className="mb-2 text-[11px] text-[#605e5c]">Duración estimada; no se muestran precios en reserva.</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                  <input
                    value={serviceQuery}
                    onChange={(event) => {
                      setServiceQuery(event.target.value);
                      setIsServiceMenuOpen(true);
                    }}
                    onFocus={() => setIsServiceMenuOpen(true)}
                    placeholder="Buscar servicio…"
                    className={`${bcField} pl-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsServiceMenuOpen((c) => !c)}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
                    aria-label="Lista de servicios"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {isServiceMenuOpen ? (
                    <div className="absolute z-[52] mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                      <div className="max-h-56 overflow-y-auto py-1">
                        {filteredServices.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron servicios.</p>
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
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                            >
                              <span className="truncate text-[#323130]">{service.name}</span>
                              <span className="shrink-0 text-xs font-medium text-[#605e5c]">{service.duration_minutes} min</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="px-0">
                {cartCount === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-8 text-[#605e5c]">
                    <ShoppingCart className="mb-2 h-10 w-10 opacity-20" />
                    <p className="text-sm italic">Opcional: agrega servicios o solo define duración abajo.</p>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#edebe9] bg-[#faf9f8] text-[11px] font-semibold uppercase text-[#605e5c]">
                        <th className="px-4 py-2">Servicio</th>
                        <th className="px-4 py-2 text-right">Tiempo</th>
                        <th className="w-10 px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f2f1]">
                      {cartLines.map((line) => {
                        const svc = services.find((s) => s.id === line.service_id);
                        return (
                          <tr key={line.localId} className="transition-colors hover:bg-[#f3f2f1]">
                            <td className="px-4 py-3">
                              <select
                                value={line.service_id}
                                onChange={(event) => changeLineService(line.localId, event.target.value)}
                                className="h-9 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                              >
                                <option value="">Servicio…</option>
                                {services.map((service) => (
                                  <option key={service.id} value={service.id}>
                                    {service.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-[#605e5c]">
                              {svc ? `${svc.duration_minutes} min` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeLine(line.localId)}
                                className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                                aria-label="Quitar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="pb-4">
              <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
                <p className="text-sm font-semibold text-[#323130]">Datos de la reserva</p>
                <p className="text-xs text-[#605e5c]">
                  Fecha del día: <span className="font-medium text-[#323130]">{dateLabel}</span>
                </p>
              </div>

              <div className="border-b border-[#edebe9] px-4 py-4">
                <p className={labelClass}>Clienta *</p>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                    <input
                      value={selectedClient ? `${selectedClient.nombre} ${selectedClient.apellido}`.trim() : clientSearch}
                      onChange={(event) => {
                        setSelectedClient(null);
                        setClientSearch(event.target.value);
                        setIsClientMenuOpen(true);
                      }}
                      onFocus={() => setIsClientMenuOpen(true)}
                      placeholder="Nombre, apellido o teléfono…"
                      className={`${bcField} pl-9`}
                      disabled={Boolean(selectedClient)}
                    />
                    {!selectedClient ? (
                      <button
                        type="button"
                        onClick={() => setIsClientMenuOpen((c) => !c)}
                        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
                        aria-label="Clientes"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    ) : null}
                    {!selectedClient && isClientMenuOpen ? (
                      <div className="absolute z-[52] mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                        <div className="max-h-56 overflow-y-auto py-1">
                          {isSearchingClients ? (
                            <p className="px-3 py-2 text-xs text-[#605e5c]">Buscando…</p>
                          ) : filteredClients.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-[#605e5c]">Escribe al menos 2 caracteres.</p>
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
                                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                                >
                                  <span className="truncate text-[#323130]">{fullName}</span>
                                  <span className="ml-3 shrink-0 text-xs text-[#605e5c]">{client.phone || "—"}</span>
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#605e5c] transition hover:border-[#0078d4] hover:bg-[#f3f2f1] hover:text-[#0078d4]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {selectedClient ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-[#0078d4] hover:underline"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientSearch("");
                      setIsClientMenuOpen(false);
                    }}
                  >
                    Cambiar clienta
                  </button>
                ) : null}
                {selectedClient ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] text-[#605e5c]">Nº / teléfono</p>
                      <p className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-semibold tabular-nums text-[#323130]">
                        {selectedClient.phone?.trim() || `#${selectedClient.id}`}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-[#605e5c]">Nombre</p>
                      <p className="truncate rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">
                        {selectedClient.nombre} {selectedClient.apellido}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-[#edebe9] px-4 py-4">
                <div>
                  <label className={labelClass} htmlFor="res-time">
                    Hora de inicio
                  </label>
                  <input
                    id="res-time"
                    type="time"
                    step={300}
                    value={startTime}
                    onChange={(ev) => setStartTime(ev.target.value)}
                    className={bcField}
                  />
                  <p className="mt-1 text-[10px] text-[#605e5c]">Cualquier hora del día.</p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="res-duration">
                    Duración (min)
                  </label>
                  <input
                    id="res-duration"
                    type="number"
                    min={15}
                    step={5}
                    value={durationMinutes}
                    onChange={(ev) => setDurationMinutes(Number(ev.target.value))}
                    className={bcField}
                  />
                </div>
              </div>

              <div className="border-b border-[#edebe9] px-4 py-4">
                <label className={labelClass} htmlFor="res-pro">
                  Operaria / puesto
                </label>
                <div className="relative">
                  <select
                    id="res-pro"
                    value={professionalId}
                    onChange={(ev) => setProfessionalId(ev.target.value)}
                    disabled={!branchId}
                    className={`${bcField} cursor-pointer appearance-none pr-8`}
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
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#edebe9] bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <div className="mb-3 rounded-sm border border-[#e1eaf3] bg-[#f7fbff] px-3 py-2 text-center">
              <span className="text-xs font-semibold text-[#004578]">Solo reserva en agenda</span>
              <p className="mt-0.5 text-[11px] text-[#605e5c]">No se registra monto ni pago aquí.</p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition-all ${
                isSubmitting ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]" : "bg-[#0078d4] text-white shadow-sm hover:bg-[#005a9e] active:bg-[#004578]"
              }`}
            >
              Confirmar reserva
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-sm border border-[#edebe9] text-sm font-semibold text-[#605e5c] transition hover:bg-[#f3f2f1]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export type DailyAgendaPageProps = {
  /** Dentro del hub Caja & seguimiento: sin título global duplicado. */
  embedded?: boolean;
};

export default function DailyAgendaPage({ embedded = false }: DailyAgendaPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateInputValue());
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranchId());
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalForSelect[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTime, setModalTime] = useState("09:00");
  const [modalProId, setModalProId] = useState<number | null>(null);
  const [isRegisterClientOpen, setIsRegisterClientOpen] = useState(false);
  const [eyeTypes, setEyeTypes] = useState<EyeTypeOption[]>([]);
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [eyeTypesError, setEyeTypesError] = useState<string | null>(null);
  const [isLoadingEyeTypes, setIsLoadingEyeTypes] = useState(false);
  const [registeredClientPick, setRegisteredClientPick] = useState<ClientForSelect | null>(null);
  const [activeDragTicket, setActiveDragTicket] = useState<TicketItem | null>(null);
  const [reschedulingTicketId, setReschedulingTicketId] = useState<number | null>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;
    return closestCenter(args);
  };

  const [agendaView, setAgendaView] = useState<AgendaViewMode>(() => {
    try {
      const v = localStorage.getItem(AGENDA_VIEW_STORAGE_KEY);
      if (v === "planner" || v === "stations") return v;
    } catch {
      /* ignore */
    }
    return "planner";
  });

  const setViewMode = useCallback((mode: AgendaViewMode) => {
    setAgendaView(mode);
    try {
      localStorage.setItem(AGENDA_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const loadEyeTypes = useCallback(async () => {
    setIsLoadingEyeTypes(true);
    setEyeTypesError(null);
    try {
      const data = await ClientService.listEyeTypes({ limit: 100 });
      setEyeTypes(data.length > 0 ? data : []);
    } catch {
      setEyeTypesError("No se pudieron cargar. Intenta de nuevo.");
    } finally {
      setIsLoadingEyeTypes(false);
    }
  }, []);

  useEffect(() => {
    void loadEyeTypes();
  }, [loadEyeTypes]);

  useEffect(() => {
    BranchService.list({ limit: 200 })
      .then((data) => setBranches(data))
      .catch(() => setBranches([]));
  }, []);

  const consumeRegisteredClientPick = useCallback(() => setRegisteredClientPick(null), []);

  const handleRegisterClientSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const nombre = String(formData.get("nombre") ?? "").trim();
    const apellido = String(formData.get("apellido") ?? "").trim();
    const edadRaw = String(formData.get("edad") ?? "").trim();
    const phoneCountryCode = String(formData.get("phone_country_code") ?? "+591").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const eyeTypeRaw = String(formData.get("eye_type_id") ?? "").trim();
    const branchRaw = String(formData.get("branch_id") ?? "").trim();

    if (!nombre || !apellido) {
      toast.warning("Nombre y apellido son obligatorios.");
      return;
    }

    const parsedEdad = Number(edadRaw);
    const edad = edadRaw && Number.isFinite(parsedEdad) ? parsedEdad : undefined;
    if (edad !== undefined && (edad < 1 || edad > 100)) {
      toast.warning(edad < 1 ? "La edad no puede ser 0." : "La edad no puede ser mayor a 100.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const formattedPhone = normalizedPhone ? `${phoneCountryCode}${normalizedPhone}` : undefined;

    const parsedEyeTypeId = Number(eyeTypeRaw);
    const eye_type_id = eyeTypeRaw && Number.isFinite(parsedEyeTypeId) && parsedEyeTypeId > 0 ? parsedEyeTypeId : undefined;

    const parsedBranchId = Number(branchRaw);
    let branch_id: number | undefined =
      branchRaw && Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : undefined;

    if (!branch_id && branchId) {
      branch_id = branchId;
    }

    try {
      const created = await ClientService.create({
        name: nombre,
        last_name: apellido,
        age: edad,
        phone: formattedPhone,
        eye_type_id,
        branch_id,
      });

      setRegisteredClientPick({
        id: created.id,
        nombre: created.nombre,
        apellido: created.apellido,
        phone: created.phone ?? null,
      });
      toast.success("Cliente registrado correctamente.");
      setIsRegisterClientOpen(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "No se pudo registrar la clienta."));
    }
  };

  useEffect(() => {
    const handle = () => setBranchId(getSelectedBranchId());
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === BRANCH_STORAGE_KEY) handle();
    };
    window.addEventListener("branchchange", handle);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("branchchange", handle);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const loadDay = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await AgendaService.listTickets({
        limit: 500,
        branch_id: branchId ?? undefined,
        start_date: selectedDate,
        end_date: selectedDate,
      });
      setTickets(data);
    } catch {
      toast.error("No se pudieron cargar las reservas del día.");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, selectedDate]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  useEffect(() => {
    void (async () => {
      try {
        const [pros, svc] = await Promise.all([
          AgendaService.listProfessionalsForSelect({
            limit: 200,
            role_name: "Operaria",
            branch_id: branchId ?? undefined,
          }),
          AgendaService.listServices({ limit: 200, branch_id: branchId ?? undefined }),
        ]);
        setProfessionals(pros);
        setServices(svc);
      } catch {
        setProfessionals([]);
        setServices([]);
      }
    })();
  }, [branchId]);

  const weekdayUpper = useMemo(() => {
    try {
      return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-BO", { weekday: "long" }).toUpperCase();
    } catch {
      return "—";
    }
  }, [selectedDate]);

  const headerTitle = useMemo(() => {
    try {
      const d = new Date(`${selectedDate}T12:00:00`);
      const wd = d.toLocaleDateString("es-BO", { weekday: "long" });
      const cap = wd.charAt(0).toUpperCase() + wd.slice(1);
      const rest = d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `${cap} ${rest}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const monthLabel = useMemo(() => {
    try {
      return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-BO", { month: "long", year: "numeric" });
    } catch {
      return "";
    }
  }, [selectedDate]);

  const dayNumber = useMemo(() => {
    try {
      return String(new Date(`${selectedDate}T12:00:00`).getDate());
    } catch {
      return "";
    }
  }, [selectedDate]);

  const weekStrip = useMemo(() => buildWeekStrip(selectedDate), [selectedDate]);

  const plannerMap = useMemo(
    () => groupTicketsByPlannerSlot(tickets, selectedDate),
    [tickets, selectedDate]
  );

  const stationGridMap = useMemo(
    () => groupTicketsByHourAndStation(tickets, selectedDate, professionals),
    [tickets, selectedDate, professionals]
  );

  const stationLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < STATION_COUNT; i += 1) {
      const p = professionals[i];
      labels.push(p ? `${i + 1} · ${p.username}` : `${i + 1}`);
    }
    return labels;
  }, [professionals]);

  const openNewModal = (time: string, professionalId: number | null) => {
    setModalTime(time);
    setModalProId(professionalId);
    setModalOpen(true);
  };

  const shiftDate = (delta: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toIsoDate(d));
  };

  const rescheduleTicket = useCallback(
    async (
      ticketId: number,
      target: { hour: number; minute: number; professionalId?: number | null }
    ) => {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) return;

      const { start_time, end_time } = buildRescheduleTimes(
        ticket,
        selectedDate,
        target.hour,
        target.minute
      );

      setReschedulingTicketId(ticketId);
      try {
        await AgendaService.updateAppointment(ticketId, {
          start_time,
          end_time,
          ...(target.professionalId !== undefined ? { professional_id: target.professionalId } : {}),
        });
        await loadDay();
        toast.success("Reserva reprogramada.");
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, "No se pudo reprogramar la reserva."));
      } finally {
        setReschedulingTicketId(null);
      }
    },
    [loadDay, selectedDate, tickets]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketItem | undefined;
    if (ticket) setActiveDragTicket(ticket);
  };

  const handleDragCancel = () => {
    setActiveDragTicket(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTicket(null);
    const { active, over } = event;
    if (!over || reschedulingTicketId != null) return;

    const ticketId = parseDragTicketId(active.id);
    const dropTarget = parseDropTarget(over.id);
    if (ticketId == null || !dropTarget) return;

    if (dropTarget.type === "planner") {
      const hour = Math.floor(dropTarget.minuteOfDay / 60);
      const minute = dropTarget.minuteOfDay % 60;
      void rescheduleTicket(ticketId, { hour, minute });
      return;
    }

    const pro = professionals[dropTarget.col];
    void rescheduleTicket(ticketId, {
      hour: dropTarget.hour,
      minute: 0,
      professionalId: pro?.id ?? null,
    });
  };

  const layoutPageClass = embedded
    ? "!min-h-0 flex flex-1 flex-col !bg-transparent !p-0 h-full"
    : undefined;
  const layoutContainerClass = embedded
    ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-transparent !p-0 max-w-none"
    : undefined;

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 w-full flex-1 flex-col overflow-auto bg-transparent"
          : "min-h-0 w-full overflow-auto bg-transparent"
      }
    >
      <Layout
        title={embedded ? undefined : "Agenda del día"}
        subtitle={
          embedded
            ? undefined
            : "Planilla horaria o puestos (1–8). Arrastra reservas para cambiar hora u operaria; toca un hueco vacío para crear cita."
        }
        variant="table"
        pageClassName={layoutPageClass}
        containerClassName={layoutContainerClass}
      >
        <SectionCard className="mb-3 border border-[#d2d0ce] bg-[#faf9f8]">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#c7e0f4] bg-[#deecf9] text-[#005a9e]">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Calendario · reservas</p>
                <p className="text-[11px] text-[#605e5c]">
                  Toca una casilla vacía para nueva reserva. Arrastra una tarjeta por el asa (
                  <span className="inline-block align-middle">⋮⋮</span>) a otra hora o puesto para reprogramar.
                </p>
              </div>
            </div>

            <div
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
              role="group"
              aria-label="Tipo de vista"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Vista</span>
                <div className="inline-flex rounded-lg border border-[#c8c6c4] bg-white p-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setViewMode("planner")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      agendaView === "planner"
                        ? "bg-[#0078d4] text-white shadow-sm"
                        : "text-[#605e5c] hover:bg-[#f3f2f1]"
                    }`}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Planilla horaria
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("stations")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      agendaView === "stations"
                        ? "bg-[#0078d4] text-white shadow-sm"
                        : "text-[#605e5c] hover:bg-[#f3f2f1]"
                    }`}
                  >
                    <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Puestos 1–8
                  </button>
                </div>
              </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#edebe9] pt-3 sm:border-t-0 sm:pt-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() => setSelectedDate(getLocalDateInputValue())}
                  >
                    Hoy
                  </Button>
                  <div className="flex max-w-[min(100vw-2rem,520px)] gap-1 overflow-x-auto pb-1">
                    {weekStrip.map((dayIso) => {
                      const isSel = dayIso === selectedDate;
                      const short = new Date(`${dayIso}T12:00:00`).toLocaleDateString("es-BO", {
                        weekday: "short",
                      });
                      const num = new Date(`${dayIso}T12:00:00`).getDate();
                      return (
                        <button
                          key={dayIso}
                          type="button"
                          onClick={() => setSelectedDate(dayIso)}
                          className={`flex min-w-[44px] shrink-0 flex-col items-center rounded-md border px-1.5 py-1 text-[10px] transition ${
                            isSel
                              ? "border-[#0078d4] bg-[#deecf9] font-semibold text-[#004578]"
                              : "border-[#edebe9] bg-white text-[#605e5c] hover:border-[#c8c6c4]"
                          }`}
                        >
                          <span className="uppercase leading-none">{short.replace(/\.$/, "")}</span>
                          <span className="text-sm font-bold tabular-nums leading-tight">{num}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#edebe9] pt-3 sm:border-t-0 sm:pt-0">
                <span className="text-xs text-[#605e5c]">
                  MES: <strong className="text-[#323130]">{monthLabel}</strong> · DÍA:{" "}
                  <strong className="text-[#323130]">{dayNumber}</strong>
                </span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="secondary" size="sm" className="h-8 px-2" onClick={() => shiftDate(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 rounded-md border border-[#8a8886] px-2 text-sm"
                  />
                  <Button type="button" variant="secondary" size="sm" className="h-8 px-2" onClick={() => shiftDate(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" size="sm" className="h-8 gap-1" onClick={() => openNewModal("09:00", null)}>
                  <Plus className="h-3.5 w-3.5" />
                  Nueva reserva
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <DndContext
          sensors={dndSensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
        {/* Vista planilla (franja horaria detallada) */}
        {agendaView === "planner" ? (
        <section className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-[#c7d9e8] bg-white shadow-sm print:shadow-none">
          <div className="bg-[#b8d6f0] px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-[#1a3a52] print:bg-[#b8d6f0]">
            {headerTitle}
          </div>
          <p className="border-b border-[#e1eaf3] bg-[#f7fbff] px-3 py-1 text-center text-[10px] text-[#605e5c]">
            FECHA DE INICIO ({weekdayUpper})
          </p>
          <div className="max-h-[min(72vh,900px)] overflow-auto">
            <div
              className="grid min-w-[min(100%,720px)]"
              style={{ gridTemplateColumns: "92px minmax(240px, 1fr)" }}
            >
              {PLANNER_SLOTS.map((slot, idx) => {
                const rowTickets = plannerMap.get(slot.minuteOfDay) ?? [];
                const zebra = idx % 2 === 0;
                return (
                  <div key={`${slot.minuteOfDay}-${slot.stepMinutes}`} className="contents">
                    <div
                      className={`border-b border-r border-[#d5e5f2] px-2 py-1.5 text-xs font-medium tabular-nums ${
                        zebra ? "bg-[#f0f7fc]" : "bg-white"
                      }`}
                    >
                      {slot.label}
                    </div>
                    <AgendaDropCell
                      id={plannerDropId(slot.minuteOfDay)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          const h = Math.floor(slot.minuteOfDay / 60);
                          const m = slot.minuteOfDay % 60;
                          openNewModal(
                            `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                            null
                          );
                        }
                      }}
                      onClick={() => {
                        if (activeDragTicket) return;
                        const h = Math.floor(slot.minuteOfDay / 60);
                        const m = slot.minuteOfDay % 60;
                        openNewModal(
                          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                          null
                        );
                      }}
                      className={`border-b border-[#d5e5f2] px-2 py-1.5 cursor-pointer rounded-sm transition hover:bg-[#eef6fc] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0078d4]/35 ${
                        zebra ? "bg-[#f5faff]" : "bg-[#fafcfe]"
                      }`}
                    >
                      <div className="flex min-h-[88px] flex-wrap items-start gap-1.5 content-start py-0.5">
                        {rowTickets.map((t) => (
                          <DraggableAgendaTicketCard
                            key={t.id}
                            ticket={t}
                            disabled={reschedulingTicketId === t.id}
                          />
                        ))}
                      </div>
                    </AgendaDropCell>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        ) : null}

        {agendaView === "stations" ? (
        <section className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-sm">
          <div className="border-b border-[#edebe9] bg-[#f3f2f1] px-3 py-2.5">
            <h2 className="text-sm font-semibold text-[#323130]">Vista puestos (1–8)</h2>
            <p className="mt-0.5 text-[11px] text-[#605e5c]">
              Filas por hora ({GRID_FIRST_HOUR}:00–{GRID_LAST_HOUR}:00). Columnas = operarias en orden (máx. 8).
            </p>
          </div>
          <div className="max-h-[min(72vh,900px)] overflow-auto p-2 sm:p-3">
            <div
              className="grid w-full min-w-[min(100%,920px)]"
              style={{
                gridTemplateColumns: `72px repeat(${STATION_COUNT}, minmax(88px, 1fr))`,
              }}
            >
              <div className="sticky left-0 z-10 border border-[#edebe9] bg-[#e8e8e8] px-1 py-2 text-[10px] font-semibold uppercase text-[#605e5c]">
                Hora
              </div>
              {stationLabels.map((label) => (
                <div
                  key={label}
                  className="border border-[#edebe9] bg-[#deecf9] px-1 py-2 text-center text-[10px] font-semibold leading-tight text-[#004578]"
                >
                  {label}
                </div>
              ))}

              {Array.from({ length: GRID_LAST_HOUR - GRID_FIRST_HOUR + 1 }, (_, i) => GRID_FIRST_HOUR + i).map((hour) => (
                <div key={`row-${hour}`} className="contents">
                  <div className="sticky left-0 z-10 border border-[#edebe9] bg-[#f3f2f1] px-2 py-3 text-xs font-semibold tabular-nums">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {Array.from({ length: STATION_COUNT }, (_, col) => {
                    const key = `${hour}__${col}`;
                    const cellTickets = stationGridMap.get(key) ?? [];
                    const pro = professionals[col];
                    return (
                      <AgendaDropCell
                        key={key}
                        id={stationDropId(hour, col)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openNewModal(`${String(hour).padStart(2, "0")}:00`, pro?.id ?? null);
                          }
                        }}
                        onClick={() => {
                          if (activeDragTicket) return;
                          openNewModal(`${String(hour).padStart(2, "0")}:00`, pro?.id ?? null);
                        }}
                        className="relative min-h-[88px] cursor-pointer border border-[#edebe9] bg-white p-1.5 transition hover:bg-[#faf9f8] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#0078d4]/35 sm:min-h-[96px]"
                      >
                        <div className="flex min-h-[80px] flex-wrap items-start gap-1 content-start">
                          {cellTickets.map((t) => (
                            <DraggableAgendaTicketCard
                              key={t.id}
                              ticket={t}
                              compact
                              disabled={reschedulingTicketId === t.id}
                            />
                          ))}
                        </div>
                        <span
                          className="pointer-events-none absolute bottom-0.5 right-0.5 rounded bg-white/90 px-1 text-[9px] text-[#a19f9d] opacity-60"
                          aria-hidden
                        >
                          +
                        </span>
                      </AgendaDropCell>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {isLoading ? (
          <p className="mt-3 text-center text-xs text-[#605e5c]">Cargando reservas…</p>
        ) : null}

        <DragOverlay dropAnimation={null}>
          {activeDragTicket ? (
            <AgendaTicketCard ticket={activeDragTicket} compact={agendaView === "stations"} />
          ) : null}
        </DragOverlay>
        </DndContext>
      </Layout>

      <ReservationDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadDay()}
        branchId={branchId}
        services={services}
        professionals={professionals}
        selectedDate={selectedDate}
        initialTime={modalTime}
        initialProfessionalId={modalProId}
        registeredClient={registeredClientPick}
        onConsumeRegisteredClient={consumeRegisteredClientPick}
        onOpenRegisterClient={() => setIsRegisterClientOpen(true)}
      />

      <RegisterClientModal
        isOpen={isRegisterClientOpen}
        onClose={() => setIsRegisterClientOpen(false)}
        onSubmit={handleRegisterClientSubmit}
        eyeTypes={eyeTypes}
        branches={branches}
        eyeTypesError={eyeTypesError}
        isLoadingEyeTypes={isLoadingEyeTypes}
        onRetryEyeTypes={() => void loadEyeTypes()}
        mode="create"
        initialClient={null}
        defaultBranchId={branchId}
      />
    </div>
  );
}
