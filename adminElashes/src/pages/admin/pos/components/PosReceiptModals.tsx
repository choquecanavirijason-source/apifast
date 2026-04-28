import { useMemo, useState, type RefObject } from "react";
import { Clock, Printer, ReceiptText } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import GenericModal from "../../../../components/common/modal/GenericModal";
import { type PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import type { ProfessionalForSelect, TicketItem } from "../../../../core/services/agenda/agenda.service";
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
  receiptTicketEdits: _receiptTicketEdits,
  professionals,
  onUpdateReceiptTicketEdit,
  onSaveReceiptTicketEdits: _onSaveReceiptTicketEdits,
  isSavingReceiptTickets: _isSavingReceiptTickets,
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
  void setAvailabilityPreviewLineId;
  const [dragOverDayIndex, setDragOverDayIndex] = useState<number | null>(null);

  const handleDirectPrintReceipt = () => {
    onOpenPrintPreview();
    // Espera a que el portal de impresión monte en el DOM antes de llamar a print.
    let attempts = 0;
    const tryPrint = () => {
      const card = document.getElementById("print-ticket-card");
      if (card) {
        onPrint();
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        window.setTimeout(tryPrint, 50);
      }
    };
    window.setTimeout(tryPrint, 50);
  };

  const availabilityTitle = useMemo(
    () => `Reservas del dia ${availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate}`,
    [availabilityPreviewDate, activeAvailabilityLine, saleBaseDate]
  );

  const weekDays = useMemo(() => {
    const base = new Date(availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate);
    const day = base.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMonday);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [availabilityPreviewDate, activeAvailabilityLine, saleBaseDate]);

  const calendarHours = useMemo(() => {
    const arr: number[] = [];
    for (let h = 7; h <= 20; h++) arr.push(h);
    return arr;
  }, []);

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
                    const dateInfo = toDateAndTimeInputValues(appointment.start_time);
                    const professionalName =
                      appointment.professional?.username ??
                      "Sin operaria";
                    const statusLabel = appointment.status === "in_service" ? "En atención" : "En espera";
                    return (
                      <div key={appointment.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {appointment.ticket_code ?? `#${appointment.id}`}
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {statusLabel}
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

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-sm border border-[#edebe9] bg-white p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#605e5c]">Fecha</p>
                            <p className="text-xs font-semibold text-[#323130]">{dateInfo.date || "Sin fecha"}</p>
                          </div>

                          <div className="rounded-sm border border-[#edebe9] bg-white p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#605e5c]">Hora</p>
                            <p className="text-xs font-semibold text-[#323130]">
                              {dateInfo.without_time ? "Sin hora" : dateInfo.time || "Sin hora"}
                            </p>
                          </div>

                          <div className="rounded-sm border border-[#edebe9] bg-white p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#605e5c]">Operaria</p>
                            <p className="text-xs font-semibold text-[#323130]">{professionalName}</p>
                          </div>

                          <div className="rounded-sm border border-[#edebe9] bg-white p-2">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#605e5c]">Estado</p>
                            <p className="text-xs font-semibold text-[#323130]">{statusLabel}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
                onClick={handleDirectPrintReceipt}
              >
                <Printer className="h-4 w-4" />Imprimir comprobante
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
                      const fallback = toDateAndTimeInputValues(appointment.start_time);
                      const displayTime = fallback.without_time ? "Sin hora" : fallback.time;

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
        size="xl"
        contentClassName="!max-w-6xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3 sm:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#605e5c]">Fecha</p>
              <input
                type="date"
                value={availabilityPreviewDate || activeAvailabilityLine?.date || saleBaseDate}
                onChange={(event) => setAvailabilityPreviewDate(event.target.value)}
                className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#605e5c]">Buscar</p>
              <input
                type="text"
                value={availabilitySearch}
                onChange={(event) => setAvailabilitySearch(event.target.value)}
                placeholder="Operaria, cliente o servicio"
                className="h-10 w-full rounded-sm border border-[#8a8886] bg-white px-3 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
            <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#605e5c]">Calendario semanal</p>
                  <span className="rounded-full border border-[#d2d0ce] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#605e5c]">Semana</span>
                </div>

                <div className="overflow-auto">
                  <div className="inline-block min-w-full">
                    <div className="grid grid-cols-[56px_repeat(7,1fr)] items-center bg-white">
                      <div />
                      {weekDays.map((d) => (
                        <div key={d.toISOString()} className="border-l border-b px-3 py-2 text-center text-sm font-semibold">
                          <div>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                          <div className="text-xs text-[#605e5c]">{d.toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                      <div className="flex flex-col">
                        {calendarHours.map((h) => (
                          <div key={h} className="h-12 border-b pr-2 text-right text-xs text-[#605e5c]">{`${String(h).padStart(2,'0')}:00`}</div>
                        ))}
                      </div>

                      {weekDays.map((d, dayIndex) => (
                        <div
                          key={d.toISOString()}
                          className={`relative ${dragOverDayIndex === dayIndex ? 'bg-[#f3fbff]' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverDayIndex(dayIndex);
                          }}
                          onDragLeave={() => setDragOverDayIndex(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverDayIndex(null);
                            const id = e.dataTransfer.getData('application/ticket-id') || e.dataTransfer.getData('text/ticket-id');
                            if (!id) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const hourHeight = 48; // px per hour as used above
                            const dayStartHour = calendarHours[0];
                            let hourIndex = Math.floor(y / hourHeight);
                            if (hourIndex < 0) hourIndex = 0;
                            if (hourIndex >= calendarHours.length) hourIndex = calendarHours.length - 1;
                            const hour = dayStartHour + hourIndex;
                            const minutesFloat = ((y % hourHeight) / hourHeight) * 60;
                            const minutes = Math.max(0, Math.min(59, Math.round(minutesFloat / 5) * 5));
                            const hh = String(hour).padStart(2, '0');
                            const mm = String(minutes).padStart(2, '0');
                            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            // call parent handler to update this ticket
                            onUpdateReceiptTicketEdit(Number(id), { date: dateStr, time: `${hh}:${mm}`, without_time: false });
                          }}
                        >
                          {calendarHours.map((h) => (
                            <div key={h} className="h-12 border-b border-l" />
                          ))}

                          {/* render events that match this date */}
                          {occupiedTicketsForPreview
                            .filter((ticket) => {
                              const t = new Date(ticket.start_time);
                              return (
                                t.getFullYear() === d.getFullYear() &&
                                t.getMonth() === d.getMonth() &&
                                t.getDate() === d.getDate()
                              );
                            })
                            .map((ticket) => {
                              const s = new Date(ticket.start_time);
                              const e = new Date(ticket.end_time);
                              const dayStartHour = calendarHours[0];
                              const top = ((s.getHours() + s.getMinutes()/60) - dayStartHour) * 48; // 48px per hour
                              const height = Math.max(24, ((e.getTime() - s.getTime()) / (1000*60*60)) * 48);
                              return (
                                <div
                                  key={ticket.id}
                                  className="absolute left-2 right-2 rounded px-2 py-1 text-xs text-white shadow"
                                  style={{ top, height, background: '#d13438' }}
                                  title={`${ticket.client_name} · ${ticket.professional_name || ''}`}
                                >
                                  <div className="truncate font-semibold">{ticket.client_name ?? 'Reservado'}</div>
                                  <div className="truncate text-[10px]">{formatHourMinute(ticket.start_time)} - {formatHourMinute(ticket.end_time)}</div>
                                </div>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
            </div>

            <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#605e5c]">Reservas del día</p>
                <span className="rounded-full border border-[#d2d0ce] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#605e5c]">
                  {occupiedTicketsForPreview.length}
                </span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {occupiedTicketsForPreview.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay reservas ocupadas para ese día con este filtro.</p>
                ) : (
                  occupiedTicketsForPreview.map((ticket) => {
                    const professionalName =
                      ticket.professional_name ??
                      professionals.find((professional) => professional.id === ticket.professional_id)?.username ??
                      "Sin operaria";

                    return (
                      <div
                        key={ticket.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/ticket-id', String(ticket.id));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="flex items-start justify-between gap-2 rounded-sm border border-[#edebe9] bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#323130]">{professionalName}</p>
                          <p className="truncate text-[11px] text-[#605e5c]">
                            {ticket.client_name} · {(ticket.service_name ?? (ticket.service_names ?? []).join(" · ")) || "Servicio"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-[#0078d4]">
                          {formatHourMinute(ticket.start_time)} - {formatHourMinute(ticket.end_time)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </GenericModal>
    </>
  );
}
