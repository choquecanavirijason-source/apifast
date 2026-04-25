import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Trash2,
} from "lucide-react";

import { TICKET_STATUS_OPTIONS } from "../pos.constants";
import type { PosSaleStepTwoProps } from "../pos.types";

export default function PosSaleStepTwo({
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
  isSubmitting,
  onCheckout,
  onBack,
}: PosSaleStepTwoProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[#f3f2f1] text-[#323130]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#edebe9] bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-sm font-semibold text-[#323130] shadow-sm transition hover:bg-[#f3f2f1]"
          >
            <ArrowLeft className="h-4 w-4 text-[#0078d4]" />
            Volver a la venta
          </button>
          <div className="hidden h-6 w-px bg-[#edebe9] sm:block" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-[#323130]">Tickets y agenda</h2>
            <p className="text-xs text-[#605e5c]">Fecha, hora, operaria y estado por cada servicio</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Subtotal</p>
          <p className="text-sm font-semibold text-[#323130]">Bs {subtotal.toFixed(2)}</p>
          <p className="text-[11px] text-[#605e5c]">{cartLines.length} ticket(s)</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
      <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
              <span className="text-sm font-semibold text-[#323130]">Líneas del pedido</span>
              {cartLines.length > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0078d4] px-1.5 text-[10px] font-bold text-white">
                  {cartLines.length}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-[#edebe9] overflow-y-auto">
            {cartLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#605e5c]">
                <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8]">
                  <ShoppingCart className="h-6 w-6 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Sin tickets</p>
                  <p className="mt-0.5 text-xs">Vuelve al paso anterior y agrega servicios</p>
                </div>
              </div>
            ) : (
              cartLines.map((line) => {
                const service = services.find((item) => String(item.id) === line.service_id);
                return (
                  <div key={line.localId} className="px-4 py-4 transition-colors hover:bg-[#faf9f8]/80 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {service?.image_url ? (
                          <img
                            src={service.image_url}
                            alt={service?.name ?? "Servicio"}
                            className="h-10 w-10 flex-none rounded-sm border border-[#edebe9] object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#323130]">{service?.name ?? "Servicio"}</p>
                          <p className="mt-0.5 text-[11px] text-[#605e5c]">Asignación a la agenda</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="block text-sm font-semibold text-[#323130]">Bs {line.price.toFixed(2)}</span>
                          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#605e5c]">
                            <Clock className="h-3 w-3" />
                            {line.duration_minutes}m
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.localId)}
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-sm text-[#d13438] transition hover:bg-[#fde7e9]"
                          title="Quitar ticket"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_96px]">
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Fecha</p>
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
                              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#0078d4] shadow-sm transition hover:border-[#0078d4]/40 hover:bg-[#f3f2f1]"
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                            </button>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#323130] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition group-hover:opacity-100">
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
                            className="h-8 w-full min-w-0 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Hora</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={line.time}
                            onChange={(event) => updateLine(line.localId, { time: event.target.value })}
                            disabled={line.without_time}
                            className="h-8 min-w-0 flex-1 rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1]"
                          />
                          <label className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-[#605e5c]">
                            <input
                              type="checkbox"
                              checked={line.without_time}
                              onChange={(event) =>
                                updateLine(line.localId, {
                                  without_time: event.target.checked,
                                  time: event.target.checked ? "" : "09:00",
                                })
                              }
                              className="rounded-sm border-[#8a8886] text-[#0078d4] focus:ring-[#0078d4]"
                            />
                            Sin hora
                          </label>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Operaria</p>
                        <select
                          value={line.professional_id}
                          onChange={(event) => updateLine(line.localId, { professional_id: event.target.value })}
                          className="h-8 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                        >
                          <option value="">Seleccionar…</option>
                          {professionals.map((professional) => (
                            <option key={professional.id} value={String(professional.id)}>
                              {professional.username}
                            </option>
                          ))}
                        </select>
                        <p
                          className={`mt-1 text-[10px] font-medium ${
                            !line.professional_id
                              ? "text-[#605e5c]"
                              : lineAvailability[line.localId]?.available
                                ? "text-[#107c10]"
                                : "text-[#d13438]"
                          }`}
                        >
                          {!line.professional_id
                            ? "Selecciona operaria para validar disponibilidad"
                            : lineAvailability[line.localId]?.available
                              ? "Disponible en este horario"
                              : `Ocupada (${lineAvailability[line.localId]?.conflictCount ?? 1} conflicto${
                                  (lineAvailability[line.localId]?.conflictCount ?? 1) > 1 ? "s" : ""
                                })`}
                        </p>
                      </div>

                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Estado</p>
                        <select
                          value={line.status}
                          onChange={(event) =>
                            updateLine(line.localId, {
                              status: event.target.value === "in_service" ? "in_service" : "pending",
                            })
                          }
                          className="h-8 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
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
      </div>

      <div className="shrink-0 border-t border-[#edebe9] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Total a cobrar</p>
            <p className="text-2xl font-bold text-[#0078d4]">Bs {total.toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={onCheckout}
            disabled={isSubmitting || cartLines.length === 0}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold transition sm:w-auto ${
              isSubmitting || cartLines.length === 0
                ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
                : "bg-[#0078d4] text-white shadow-sm hover:bg-[#005a9e] active:bg-[#004578]"
            }`}
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Procesando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar venta
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
