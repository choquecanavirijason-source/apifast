import { useMemo, type RefObject } from "react";
import { Clock, Printer, ReceiptText } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import GenericModal from "../../../../components/common/modal/GenericModal";
import { type PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
import { TICKET_STATUS_OPTIONS } from "../pos.constants";
import type { ReceiptTicketEdit } from "../pos.types";

type PosReceiptModalsProps = {
  receiptSale: PosSaleItem | null;
  onCloseReceipt: () => void;
  receiptTicketEdits: Record<number, ReceiptTicketEdit>;
  professionals: ProfessionalForSelect[];
  onUpdateReceiptTicketEdit: (appointmentId: number, patch: Partial<ReceiptTicketEdit>) => void;
  onSaveReceiptTicketEdits: () => void;
  isSavingReceiptTickets: boolean;
  onOpenPrintPreview: () => void;
  isPrintPreviewOpen: boolean;
  onClosePrintPreview: () => void;
  onPrint: () => void;
  printFormat: "a4" | "thermal";
  setPrintFormat: (value: "a4" | "thermal") => void;
  qrRef: RefObject<HTMLDivElement | null>;
  availabilityPreviewLineId: string | null;
  availabilityPreviewDate: string;
  saleBaseDate: string;
  activeAvailabilityLine: { date?: string | null } | null;
  setAvailabilityPreviewLineId: (value: string | null) => void;
  setAvailabilityPreviewDate: (value: string) => void;
  setAvailabilitySearch: (value: string) => void;
  availabilitySearch: string;
  occupiedTicketsForPreview: TicketItem[];
  previewHourSlots: Array<{
    hourLabel: string;
    isBusy: boolean;
    count: number;
    entries: Array<{
      ticketId: number;
      professionalName: string;
      clientName: string;
      serviceName: string;
    }>;
    extraCount: number;
  }>;
  onSelectHourFromPreview: (hourValue: string) => void;
  onCloseAvailabilityPreview: () => void;
  formatHourMinute: (iso: string) => string;
  toDateAndTimeInputValues: (iso: string) => { date: string; time: string; without_time: boolean };
};

export default function PosReceiptModals({
  receiptSale,
  onCloseReceipt,
  receiptTicketEdits,
  professionals,
  onUpdateReceiptTicketEdit,
  onSaveReceiptTicketEdits,
  isSavingReceiptTickets,
  onOpenPrintPreview,
  isPrintPreviewOpen,
  onClosePrintPreview,
  onPrint,
  printFormat,
  setPrintFormat,
  qrRef,
  availabilityPreviewLineId,
  availabilityPreviewDate,
  saleBaseDate,
  activeAvailabilityLine,
  setAvailabilityPreviewLineId,
  setAvailabilityPreviewDate,
  setAvailabilitySearch,
  availabilitySearch,
  occupiedTicketsForPreview,
  previewHourSlots,
  onSelectHourFromPreview,
  onCloseAvailabilityPreview,
  formatHourMinute,
  toDateAndTimeInputValues,
}: PosReceiptModalsProps) {
  const availabilityTitle = useMemo(
    () => `Reservas del dia ${availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate}`,
    [availabilityPreviewDate, activeAvailabilityLine, saleBaseDate]
  );

  return (
    <>
      <GenericModal
        isOpen={Boolean(receiptSale)}
        onClose={onCloseReceipt}
        title="Comprobante de Pago"
      >
        {receiptSale && (
          <div className="space-y-5 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <ReceiptText className="h-7 w-7" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Bs {receiptSale.total.toFixed(2)}</h2>
              <p className="text-sm text-slate-500">
                Venta <span className="font-mono font-semibold text-slate-700">{receiptSale.sale_code}</span> completada
              </p>
            </div>

            {receiptSale.payment_method === "qr" && (
              <div ref={qrRef} className="inline-block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <QRCodeCanvas value={receiptSale.sale_code} size={180} />
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Tickets generados</h3>
              <div className="space-y-2">
                {receiptSale.appointments.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin tickets asociados.</p>
                ) : (
                  receiptSale.appointments.map((appointment) => {
                    const edit = receiptTicketEdits[appointment.id];
                    return (
                      <div key={appointment.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {appointment.ticket_code ?? `#${appointment.id}`}
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {appointment.status === "in_service" ? "En atencion" : "En espera"}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {(appointment.services ?? []).length > 0
                                ? (appointment.services ?? []).map((service: any) => service.name).join(" · ")
                                : appointment.service?.name ?? "Servicio"}
                            </p>
                          </div>
                          <span className="flex flex-none items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(appointment.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {edit && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
                              <input
                                type="date"
                                value={edit.date}
                                onChange={(event) => onUpdateReceiptTicketEdit(appointment.id, { date: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</p>
                              <input
                                type="time"
                                value={edit.time}
                                disabled={edit.without_time}
                                onChange={(event) => onUpdateReceiptTicketEdit(appointment.id, { time: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              />
                              <label className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={edit.without_time}
                                  onChange={(event) =>
                                    onUpdateReceiptTicketEdit(appointment.id, {
                                      without_time: event.target.checked,
                                      time: event.target.checked ? "" : "09:00",
                                    })
                                  }
                                />
                                Sin hora
                              </label>
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Operaria</p>
                              <select
                                value={edit.professional_id}
                                onChange={(event) => onUpdateReceiptTicketEdit(appointment.id, { professional_id: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
                              >
                                <option value="">Sin operaria</option>
                                {professionals.map((professional) => (
                                  <option key={professional.id} value={String(professional.id)}>
                                    {professional.username}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Estado</p>
                              <select
                                value={edit.status}
                                onChange={(event) => {
                                  const nextStatus = event.target.value === "in_service" ? "in_service" : "pending";
                                  if (nextStatus === "in_service" && !edit.professional_id) {
                                    return;
                                  }
                                  onUpdateReceiptTicketEdit(appointment.id, { status: nextStatus });
                                }}
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
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {receiptSale.appointments.length > 0 && (
                <button
                  type="button"
                  onClick={onSaveReceiptTicketEdits}
                  disabled={isSavingReceiptTickets}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingReceiptTickets ? "Guardando cambios..." : "Guardar cambios de tickets"}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={onCloseReceipt}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={onOpenPrintPreview}
              >
                <Printer className="h-4 w-4" />Imprimir ticket
              </button>
            </div>
          </div>
        )}
      </GenericModal>

      {isPrintPreviewOpen && receiptSale && (
        <>
          <style>{`
            @media print {
              @page {
                size: ${printFormat === "thermal" ? "80mm auto" : "A4 portrait"};
                margin: ${printFormat === "thermal" ? "4mm" : "12mm"};
              }

              html, body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              body > *:not(#print-ticket-portal) { display: none !important; }
              #print-ticket-portal { display: block !important; position: fixed; inset: 0; background: white; z-index: 99999; }
              #print-ticket-portal .no-print { display: none !important; }

              #print-ticket-card {
                margin: 0 auto !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                border: ${printFormat === "thermal" ? "0" : "1px solid #e2e8f0"} !important;
                max-width: ${printFormat === "thermal" ? "80mm" : "190mm"} !important;
                width: 100% !important;
              }
            }
          `}</style>

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div
              id="print-ticket-portal"
              className={`relative w-full overflow-hidden bg-white shadow-2xl ${
                printFormat === "thermal" ? "max-w-sm rounded-2xl" : "max-w-2xl rounded-2xl"
              }`}
            >
              <div className="no-print flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <p className="text-sm font-semibold text-slate-700">Vista previa del ticket</p>
                <button
                  type="button"
                  onClick={onClosePrintPreview}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="no-print border-b border-slate-100 px-5 pb-1 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Formato de impresión</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintFormat("a4")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      printFormat === "a4"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Hoja grande (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat("thermal")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      printFormat === "thermal"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Impresora térmica
                  </button>
                </div>
              </div>

              <div
                id="print-ticket-card"
                className={`font-mono text-slate-800 ${printFormat === "thermal" ? "px-4 py-4 text-xs" : "px-8 py-7 text-sm"}`}
              >
                <div className="mb-4 text-center">
                  <p className={`${printFormat === "thermal" ? "text-sm" : "text-lg"} font-bold uppercase tracking-widest`}>
                    Comprobante
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(receiptSale.created_at).toLocaleDateString("es-BO", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    {new Date(receiptSale.created_at).toLocaleTimeString("es-BO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Código venta</span>
                  <span className="font-bold text-emerald-600">{receiptSale.sale_code}</span>
                </div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Cliente</span>
                  <span className="font-semibold">{receiptSale.client?.name} {receiptSale.client?.last_name}</span>
                </div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-500">Método de pago</span>
                  <span className="font-semibold capitalize">{receiptSale.payment_method}</span>
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Servicios</p>
                <div className="space-y-2">
                  {receiptSale.appointments.length === 0 ? (
                    <p className="text-center text-xs text-slate-400">Sin tickets asociados.</p>
                  ) : (
                    receiptSale.appointments.map((appointment) => {
                      const edit = receiptTicketEdits[appointment.id];
                      const displayTime = (() => {
                        if (edit?.without_time) return "Sin hora";
                        if (edit?.time?.trim()) return edit.time;
                        const fallback = toDateAndTimeInputValues(appointment.start_time);
                        return fallback.without_time ? "Sin hora" : fallback.time;
                      })();

                      return (
                        <div key={appointment.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{appointment.ticket_code ?? `#${appointment.id}`}</p>
                            <p className="text-[11px] text-slate-500">
                              {(appointment.services ?? []).length > 0
                                ? (appointment.services ?? []).map((service: any) => service.name).join(", ")
                                : appointment.service?.name ?? "Servicio"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {appointment.professional?.username ? `Operaria: ${appointment.professional.username}` : "Operaria: Sin asignar"}
                              {" · "}
                              {appointment.status === "in_service" ? "En atencion" : "En espera"}
                            </p>
                          </div>
                          <span className="mt-0.5 flex flex-none items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="h-3 w-3" />
                            {displayTime}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="my-3 border-t border-dashed border-slate-300" />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">TOTAL</span>
                  <span className="text-xl font-black text-slate-900">Bs {receiptSale.total.toFixed(2)}</span>
                </div>

                {receiptSale.payment_method === "qr" && (
                  <div ref={qrRef} className="mt-4 flex justify-center">
                    <QRCodeCanvas value={receiptSale.sale_code} size={100} />
                  </div>
                )}

                <div className="mt-4 border-t border-dashed border-slate-300 pt-3 text-center">
                  <p className="text-[11px] text-slate-400">¡Gracias por su compra!</p>
                </div>
              </div>

              <div className="no-print flex gap-2 px-5 pb-5">
                <button
                  type="button"
                  onClick={onClosePrintPreview}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onPrint}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / Guardar PDF
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <GenericModal
        isOpen={Boolean(availabilityPreviewLineId)}
        onClose={onCloseAvailabilityPreview}
        title={availabilityTitle}
        size="lg"
      >
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Fecha</p>
            <input
              type="date"
              value={availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate}
              onChange={(event) => setAvailabilityPreviewDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
            />
          </div>

          <input
            type="text"
            value={availabilitySearch}
            onChange={(event) => setAvailabilitySearch(event.target.value)}
            placeholder="Buscar operaria, cliente o servicio"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-100"
          />

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Horas disponibles y ocupadas</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {previewHourSlots.map((slot) => (
                <button
                  key={slot.hourLabel}
                  type="button"
                  onClick={() => onSelectHourFromPreview(slot.hourLabel)}
                  className={`rounded-lg border px-3 py-3 text-left text-xs transition ${
                    slot.isBusy
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold leading-none">{slot.hourLabel}</p>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
                      {slot.isBusy ? `${slot.count} ocupada(s)` : "Libre"}
                    </span>
                  </div>

                  {slot.isBusy && (
                    <div className="mt-2 space-y-1.5 rounded-md border border-rose-100 bg-white/70 p-2 text-[11px] text-slate-700">
                      {slot.entries.map((entry) => (
                        <div key={`${slot.hourLabel}-${entry.ticketId}`} className="rounded border border-slate-100 bg-white px-2 py-1">
                          <p className="truncate text-[10px] font-semibold text-rose-700">Ticket #{entry.ticketId}</p>
                          <p className="truncate">
                            <span className="font-semibold">Operaria:</span> {entry.professionalName}
                          </p>
                          <p className="truncate">
                            <span className="font-semibold">Cliente:</span> {entry.clientName}
                          </p>
                          <p className="truncate">
                            <span className="font-semibold">Servicio:</span> {entry.serviceName}
                          </p>
                        </div>
                      ))}

                      {slot.extraCount > 0 && (
                        <p className="text-[10px] font-semibold text-slate-500">+{slot.extraCount} ticket(s) más en esta hora</p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Al tocar una hora, se guarda directamente en el ticket seleccionado.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Reservas del dia</p>
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {occupiedTicketsForPreview.length === 0 ? (
                <p className="text-xs text-slate-400">No hay reservas ocupadas para ese día con este filtro.</p>
              ) : (
                occupiedTicketsForPreview.map((ticket) => {
                  const professionalName =
                    ticket.professional_name ??
                    professionals.find((professional) => professional.id === ticket.professional_id)?.username ??
                    "Sin operaria";

                  return (
                    <div
                      key={ticket.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">{professionalName}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {ticket.client_name} · {(ticket.service_name ?? (ticket.service_names ?? []).join(" · ")) || "Servicio"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatHourMinute(ticket.start_time)} - {formatHourMinute(ticket.end_time)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </GenericModal>
    </>
  );
}
