import type { RefObject } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock, Plus, Search, ShoppingCart, Tag, Trash2 } from "lucide-react";

import type { ProfessionalForSelect, ServiceOption } from "../../../../core/services/agenda/agenda.service";
import { PAYMENT_METHODS, TICKET_STATUS_OPTIONS } from "../pos.constants";
import type { CartLine } from "../pos.types";

type LineAvailability = Record<string, { available: boolean; conflictCount: number }>;

type ClientOption = {
  id: string | number;
  nombre: string;
  apellido: string;
  phone?: string | null;
};

type PosSaleStepTwoProps = {
  labelClass: string;
  fieldClass: string;
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  professionals: ProfessionalForSelect[];
  lineAvailability: LineAvailability;
  saleBaseDate: string;
  updateLine: (localId: string, patch: Partial<CartLine>) => void;
  setAvailabilityPreviewLineId: (value: string | null) => void;
  setAvailabilityPreviewDate: (value: string) => void;
  setAvailabilitySearch: (value: string) => void;
  clientComboboxRef: RefObject<HTMLDivElement | null>;
  clientSearch: string;
  setClientSearch: (value: string) => void;
  setClientId: (value: string) => void;
  isClientMenuOpen: boolean;
  setIsClientMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  filteredClients: ClientOption[];
  selectedClient: ClientOption | null;
  clientPhone: string;
  clientAddress: string;
  sellerId: string;
  setSellerId: (value: string) => void;
  discountValue: string;
  setDiscountValue: (value: string) => void;
  discountType: "amount" | "percent";
  setDiscountType: (value: "amount" | "percent") => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onOpenRegisterClient: () => void;
  isSubmitting: boolean;
  onCheckout: () => void;
};

export default function PosSaleStepTwo({
  labelClass,
  fieldClass,
  cartLines,
  services,
  subtotal,
  total,
  onRemoveLine,
  professionals,
  lineAvailability,
  saleBaseDate,
  updateLine,
  setAvailabilityPreviewLineId,
  setAvailabilityPreviewDate,
  setAvailabilitySearch,
  clientComboboxRef,
  clientSearch,
  setClientSearch,
  setClientId,
  isClientMenuOpen,
  setIsClientMenuOpen,
  filteredClients,
  selectedClient,
  clientPhone,
  clientAddress,
  sellerId,
  setSellerId,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  paymentMethod,
  setPaymentMethod,
  notes,
  setNotes,
  onOpenRegisterClient,
  isSubmitting,
  onCheckout,
}: PosSaleStepTwoProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Configura los tickets</h2>
          <p className="mt-0.5 text-xs text-slate-500">Asigna profesional, horario y estado</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Tickets</span>
            {cartLines.length > 0 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                {cartLines.length}
              </span>
            )}
          </div>
          {cartLines.length > 0 && (
            <span className="text-xs font-medium text-slate-400">
              Subtotal: <span className="font-semibold text-slate-700">Bs {subtotal.toFixed(2)}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden divide-y divide-slate-100">
          {cartLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <ShoppingCart className="h-6 w-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-slate-500">Carrito vacío</p>
                <p className="mt-0.5 text-xs text-slate-400">Selecciona un servicio para comenzar</p>
              </div>
            </div>
          ) : (
            cartLines.map((line) => {
              const service = services.find((item) => String(item.id) === line.service_id);
              return (
                <div key={line.localId} className="group px-5 py-3.5 transition hover:bg-slate-50/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {service?.image_url ? (
                        <img
                          src={service.image_url}
                          alt={service?.name ?? "Servicio"}
                          className="h-10 w-10 flex-none rounded-lg border border-slate-200 object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{service?.name ?? "Servicio"}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Configura horario y profesional para este ticket</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-slate-900">Bs {line.price.toFixed(2)}</span>
                        <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />{line.duration_minutes}m
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveLine(line.localId)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-100 hover:text-red-600"
                        title="Quitar ticket"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_96px]">
                    <div>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
                      <div className="flex items-center gap-1.5">
                        <div className="group relative inline-flex">
                          <button
                            type="button"
                            onClick={() => {
                              setAvailabilityPreviewLineId(line.localId);
                              setAvailabilityPreviewDate((line.date || saleBaseDate).trim());
                              setAvailabilitySearch("");
                            }}
                            aria-label="Ver reservas del día"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-gradient-to-b from-emerald-50 to-teal-50 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:from-emerald-100 hover:to-teal-100 hover:text-emerald-800"
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                          </button>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                            Ver reservas del día
                          </span>
                        </div>
                        <input
                          type="date"
                          value={line.date}
                          onChange={(event) => updateLine(line.localId, { date: event.target.value })}
                          onBlur={(event) => {
                            if (!event.target.value) {
                              updateLine(line.localId, { date: saleBaseDate });
                            }
                          }}
                          className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={line.time}
                          onChange={(event) => updateLine(line.localId, { time: event.target.value })}
                          disabled={line.without_time}
                          className="h-7 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                        />
                        <label className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={line.without_time}
                            onChange={(event) =>
                              updateLine(line.localId, {
                                without_time: event.target.checked,
                                time: event.target.checked ? "" : "09:00",
                              })
                            }
                          />
                          Sin hora
                        </label>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Atendera</p>
                      <select
                        value={line.professional_id}
                        onChange={(event) => updateLine(line.localId, { professional_id: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                      >
                        <option value="">Seleccionar profesional...</option>
                        {professionals.map((professional) => (
                          <option key={professional.id} value={String(professional.id)}>
                            {professional.username}
                          </option>
                        ))}
                      </select>
                      <p
                        className={`mt-1 text-[10px] font-medium ${
                          !line.professional_id
                            ? "text-slate-400"
                            : lineAvailability[line.localId]?.available
                              ? "text-emerald-600"
                              : "text-red-500"
                        }`}
                      >
                        {!line.professional_id
                          ? "Selecciona operaria para validar disponibilidad"
                          : lineAvailability[line.localId]?.available
                            ? "Operaria disponible en este horario"
                            : `Operaria ocupada (${lineAvailability[line.localId]?.conflictCount ?? 1} conflicto${
                                (lineAvailability[line.localId]?.conflictCount ?? 1) > 1 ? "s" : ""
                              })`}
                      </p>
                    </div>

                    <div>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                      <select
                        value={line.status}
                        onChange={(event) =>
                          updateLine(line.localId, {
                            status: event.target.value === "in_service" ? "in_service" : "pending",
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                      >
                        {TICKET_STATUS_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <aside className="w-full md:sticky md:top-24">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-xl font-black tracking-tight text-slate-900">Bs {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-b border-slate-100 px-5 pb-4 pt-0">
            <p className={labelClass}>Cliente</p>
            <div className="flex gap-2">
              <div className="relative flex-1" ref={clientComboboxRef}>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={clientSearch}
                  onChange={(event) => {
                    setClientSearch(event.target.value);
                    setClientId("");
                    setIsClientMenuOpen(true);
                  }}
                  onFocus={() => setIsClientMenuOpen(true)}
                  placeholder="Buscar por nombre, apellido o telefono..."
                  className={`${fieldClass} pl-10`}
                />
                <button
                  type="button"
                  onClick={() => setIsClientMenuOpen((current) => !current)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Mostrar clientes"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                {isClientMenuOpen && (
                  <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="max-h-56 overflow-y-auto py-1">
                      {filteredClients.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">No se encontraron clientes.</p>
                      ) : (
                        filteredClients.map((client) => {
                          const fullName = `${client.nombre} ${client.apellido}`.trim();
                          return (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setClientId(String(client.id));
                                setClientSearch(fullName);
                                setIsClientMenuOpen(false);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-slate-50"
                            >
                              <span className="truncate text-sm text-slate-700">{fullName}</span>
                              <span className="ml-3 shrink-0 text-xs text-slate-400">{client.phone || "Sin telefono"}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenRegisterClient}
                title="Registrar nuevo cliente"
                className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {selectedClient && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Teléfono</p>
                  <p className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">{clientPhone || "-"}</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-slate-400">Dirección</p>
                  <p className="truncate rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">{clientAddress}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-slate-100 px-5 py-4">
            <label className={labelClass}>Vendedor</label>
            <div className="relative">
              <select
                value={sellerId}
                onChange={(event) => setSellerId(event.target.value)}
                className={`${fieldClass} appearance-none cursor-pointer`}
              >
                <option value="">Seleccionar vendedor…</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.username}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-100 px-5 py-4">
            <div>
              <label className={labelClass}>Descuento</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    className={`${fieldClass} pl-10`}
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="relative w-24">
                  <select
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value as "amount" | "percent")}
                    className={`${fieldClass} appearance-none cursor-pointer pr-7 text-center`}
                  >
                    <option value="amount">Bs</option>
                    <option value="percent">%</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Método de Pago</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[11px] font-semibold transition-all ${
                      paymentMethod === value
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Notas</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className={`${fieldClass} resize-none`}
                placeholder="Observaciones opcionales…"
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <button
              type="button"
              onClick={onCheckout}
              disabled={isSubmitting || cartLines.length === 0}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold tracking-wide transition-all duration-200 ${
                isSubmitting || cartLines.length === 0
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-slate-900 text-white shadow-md hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Procesando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />Confirmar Venta<ArrowRight className="ml-auto h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
