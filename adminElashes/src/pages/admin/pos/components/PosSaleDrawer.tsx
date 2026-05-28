import { useMemo, useState, type RefObject } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Plus, Printer, Search, ShoppingCart, Tag, Ticket, Trash2, X } from "lucide-react";
import type { ProfessionalForSelect, ServiceOption } from "../../../../core/services/agenda/agenda.service";
import type { CartLine, PosCheckoutTicketPreview, PosSaleClientOption } from "../pos.types";
import { PAYMENT_METHODS } from "../pos.constants";

type PosSaleDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** "drawer" (default) = overlay deslizable | "panel" = columna fija siempre visible en desktop */
  mode?: "drawer" | "panel";
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  onChangeLineService: (localId: string, serviceId: string) => void;
  onAddServiceById: (serviceId: string) => void;
  clientComboboxRef: RefObject<HTMLDivElement | null>;
  clientSearch: string;
  setClientSearch: (value: string) => void;
  setClientId: (value: string) => void;
  isClientMenuOpen: boolean;
  setIsClientMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  filteredClients: PosSaleClientOption[];
  selectedClient: PosSaleClientOption | null;
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
  professionals: ProfessionalForSelect[];
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled: boolean;
  footerHint: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  isSubmitting?: boolean;
  linkAppointmentId?: number | null;
  ticketPreviews?: PosCheckoutTicketPreview[];
  onGoToScheduleStep?: () => void;
  /** Modo de tickets: individual (un ticket por servicio) o grupal (un ticket para todos). */
  ticketMode?: "individual" | "group";
  setTicketMode?: (mode: "individual" | "group") => void;
  onUpdateTicketTime?: (localId: string, date: string, time: string) => void;
};

export default function PosSaleDrawer({
  isOpen,
  onClose,
  cartLines,
  services,
  subtotal,
  total,
  onRemoveLine,
  onChangeLineService,
  onAddServiceById,
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
  professionals,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  footerHint,
  secondaryActionLabel,
  onSecondaryAction,
  isSubmitting = false,
  linkAppointmentId = null,
  ticketPreviews = [],
  onGoToScheduleStep,
  ticketMode = "individual",
  setTicketMode,
  onUpdateTicketTime,
  mode = "drawer",
}: PosSaleDrawerProps) {
  const isPanel = mode === "panel";

  // En modo drawer, si no está abierto no se renderiza
  if (!isOpen && !isPanel) return null;

  const cartCount = cartLines.length;
  const [serviceQuery, setServiceQuery] = useState("");
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);

  const handlePrintTickets = () => {
    if (!ticketPreviews.length) return;
    const rows = ticketPreviews
      .map(
        (p) =>
          `<tr>
            <td>${p.serviceName}</td>
            <td>${p.date}</td>
            <td>${p.without_time ? "Sin hora" : p.time}</td>
            <td>${p.professionalName}</td>
            <td>${p.status}</td>
          </tr>`
      )
      .join("");
    const win = window.open("", "_blank", "width=700,height=500");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Tickets en agenda</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; }
        h2 { font-size: 15px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f2f1; font-size: 11px; text-transform: uppercase; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Tickets en agenda</h2>
      <table>
        <thead><tr><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Operaria</th><th>Estado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <br/><button onclick="window.print()">Imprimir</button>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const labelClass = "mb-1 block text-xs font-semibold text-[#605e5c]";
  const bcField =
    "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();

  const filteredServiceOptions = useMemo(() => {
    if (!normalizedServiceQuery) return services.slice(0, 14);
    return services
      .filter((s) => s.name.toLowerCase().includes(normalizedServiceQuery))
      .slice(0, 14);
  }, [normalizedServiceQuery, services]);

  const lineCountByServiceId = useMemo(() => {
    const counts = new Map<string, number>();
    cartLines.forEach((line) => {
      const key = String(line.service_id || "");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [cartLines]);

  // ── Contenido compartido (panel + drawer) ──────────────────────────────────
  const panelHeader = (
    <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-white px-4 py-3">
      <div className="min-w-0 pr-2">
        <p className="text-base font-semibold text-[#323130]">
          {isPanel ? "Resumen de venta" : "Detalle de la venta"}
        </p>
        <p className="truncate text-xs text-[#605e5c]">
          {cartCount} servicio(s) · Total Bs {total.toFixed(2)}
        </p>
      </div>
      {!isPanel && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm p-2 text-[#605e5c] transition hover:bg-[#f3f2f1]"
          aria-label="Cerrar panel"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  const panelBody = (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      {/* ── Carrito ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#edebe9]">
        <div className="flex items-center gap-2 bg-[#faf9f8] px-4 py-3">
          <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
          <span className="text-sm font-semibold text-[#323130]">Servicios ({cartCount})</span>
        </div>

        {/* Agregar servicio desde el panel */}
        <div className="border-b border-[#edebe9] bg-white px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase text-[#605e5c]">Agregar servicio</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
            <input
              value={serviceQuery}
              onChange={(e) => { setServiceQuery(e.target.value); setIsServiceMenuOpen(true); }}
              onFocus={() => setIsServiceMenuOpen(true)}
              placeholder="Busca servicio y agrégalo..."
              className={`${bcField} pl-9`}
            />
            <button
              type="button"
              onClick={() => setIsServiceMenuOpen((c) => !c)}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {isServiceMenuOpen ? (
              <div className="absolute z-70 mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                <div className="max-h-56 overflow-y-auto py-1">
                  {filteredServiceOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron servicios.</p>
                  ) : (
                    filteredServiceOptions.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => { onAddServiceById(String(service.id)); setServiceQuery(""); setIsServiceMenuOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                      >
                        <span className="truncate text-[#323130]">{service.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-[#0078d4]">
                          Bs {Number(service.price ?? 0).toFixed(2)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Lista del carrito */}
        <div className="px-0">
          {cartCount === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-[#605e5c]">
              <ShoppingCart className="mb-3 h-9 w-9 opacity-20" />
              <p className="text-sm italic">Agrega servicios desde el catálogo</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#edebe9] bg-[#faf9f8] text-[11px] font-semibold uppercase text-[#605e5c]">
                  <th className="px-4 py-2">Servicio</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="w-10 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f2f1]">
                {cartLines.map((line) => {
                  const repeatedCount = lineCountByServiceId.get(String(line.service_id || "")) ?? 0;
                  return (
                    <tr key={line.localId} className="transition-colors hover:bg-[#f3f2f1]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={line.service_id}
                            onChange={(e) => onChangeLineService(line.localId, e.target.value)}
                            className="h-9 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35"
                          >
                            <option value="">Servicio...</option>
                            {services.map((s) => (
                              <option key={s.id} value={String(s.id)}>{s.name}</option>
                            ))}
                          </select>
                          {repeatedCount > 1 && (
                            <span className="shrink-0 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[11px] font-bold text-[#0078d4]">
                              x{repeatedCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#323130]">
                        Bs {line.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.localId)}
                          className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                          aria-label="Quitar línea"
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

        <div className="border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3 text-center text-xs text-[#605e5c]">
          Subtotal: <span className="font-semibold text-[#323130]">Bs {subtotal.toFixed(2)}</span>
          {total !== subtotal && (
            <> · Con descuento: <span className="font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span></>
          )}
        </div>
      </div>

      {/* ── Datos de la venta ────────────────────────────────────────────────── */}
      <div className="pb-4">
        <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
          <p className="text-sm font-semibold text-[#323130]">Datos de la venta</p>
          <p className="text-xs text-[#605e5c]">Cliente, cobro y notas</p>
        </div>

        {/* Cliente */}
        <div className="border-b border-[#edebe9] px-4 py-4">
          <p className={labelClass}>Cliente *</p>
          <div className="flex gap-2">
            <div className="relative flex-1" ref={clientComboboxRef}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
              <input
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setClientId(""); setIsClientMenuOpen(true); }}
                onFocus={() => setIsClientMenuOpen(true)}
                placeholder="Nombre, apellido o teléfono..."
                className={`${bcField} pl-9 ${!selectedClient ? "border-[#f5c6cb] focus:border-[#d13438] focus:ring-[#d13438]/20" : "border-[#8a8886]"}`}
              />
              <button
                type="button"
                onClick={() => setIsClientMenuOpen((c) => !c)}
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              {isClientMenuOpen && (
                <div className="absolute z-70 mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                  <div className="max-h-56 overflow-y-auto py-1">
                    {filteredClients.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron clientes.</p>
                    ) : (
                      filteredClients.map((client) => {
                        const fullName = `${client.nombre} ${client.apellido}`.trim();
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => { setClientId(String(client.id)); setClientSearch(fullName); setIsClientMenuOpen(false); }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]"
                          >
                            <span className="truncate text-[#323130]">{fullName}</span>
                            <span className="ml-3 shrink-0 text-xs text-[#605e5c]">{client.phone || "Sin tel."}</span>
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
              title="Nuevo cliente"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#605e5c] transition hover:border-[#0078d4] hover:text-[#0078d4]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {!selectedClient && clientSearch.length === 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[#d13438]">
              ⚠ Selecciona o crea un cliente para continuar
            </p>
          )}
          {selectedClient && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] text-[#605e5c]">Teléfono</p>
                <p className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">
                  {clientPhone || "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-[#605e5c]">Dirección</p>
                <p className="truncate rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">
                  {clientAddress || "—"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tickets preview + modo — colapsable */}
        {cartCount > 0 && !linkAppointmentId && (
          <div className="border-b border-[#edebe9]">
            {/* Cabecera clickeable */}
            <button
              type="button"
              onClick={() => setTicketsOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-[#f3f2f1]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Ticket className="h-4 w-4 shrink-0 text-[#0078d4]" />
                <span className="text-sm font-semibold text-[#323130]">Tickets en agenda</span>
                <span className="rounded-full bg-[#eef6ff] px-2 py-0.5 text-[10px] font-bold text-[#0078d4]">
                  {ticketMode === "group" ? "1 grupal" : `${cartCount} indiv.`}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {ticketPreviews.length > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handlePrintTickets(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handlePrintTickets(); } }}
                    className="text-[#605e5c] transition hover:text-[#0078d4]"
                    title="Imprimir tickets"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </span>
                )}
                {onGoToScheduleStep && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onGoToScheduleStep(); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onGoToScheduleStep(); } }}
                    className="text-xs font-semibold text-[#0078d4] underline-offset-2 hover:underline"
                  >
                    Ajustar
                  </span>
                )}
                {ticketsOpen
                  ? <ChevronUp className="h-4 w-4 text-[#605e5c]" />
                  : <ChevronDown className="h-4 w-4 text-[#605e5c]" />
                }
              </div>
            </button>

            {/* Contenido colapsable */}
            {ticketsOpen && (
              <div className="space-y-3 px-4 pb-4">
                <p className="text-xs text-[#605e5c]">
                  {ticketMode === "group"
                    ? "Se crea 1 ticket grupal con todos los servicios."
                    : "Se crea un ticket por cada servicio al finalizar."}
                </p>

                {/* Toggle modo individual / grupal */}
                {setTicketMode && (
                  <div className="flex overflow-hidden rounded-sm border border-[#edebe9]">
                    <button
                      type="button"
                      onClick={() => setTicketMode("individual")}
                      className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                        ticketMode === "individual"
                          ? "bg-[#0078d4] text-white"
                          : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setTicketMode("group")}
                      className={`flex flex-1 items-center justify-center gap-1.5 border-l border-[#edebe9] py-2 text-xs font-semibold transition-colors ${
                        ticketMode === "group"
                          ? "bg-[#0078d4] text-white"
                          : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"
                      }`}
                    >
                      <Ticket className="h-3.5 w-3.5" />
                      Grupal
                    </button>
                  </div>
                )}

                {ticketPreviews.length > 0 ? (
                  <ul className="max-h-72 space-y-2 overflow-y-auto rounded-sm border border-[#edebe9] bg-[#faf9f8] p-2">
                    {ticketPreviews.map((preview) => (
                      <li key={preview.localId} className="rounded-sm border border-[#edebe9] bg-white p-2.5 text-xs">
                        {/* Nombre del servicio */}
                        <p className="mb-2 font-semibold text-[#323130]">{preview.serviceName}</p>

                        {/* Inputs de fecha y hora */}
                        {onUpdateTicketTime ? (
                          <div className="mb-2 grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                                Fecha
                              </label>
                              <input
                                type="date"
                                value={preview.date}
                                onChange={(e) =>
                                  onUpdateTicketTime(preview.localId, e.target.value, preview.time)
                                }
                                className="h-7 w-full rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/30"
                              />
                            </div>
                            <div>
                              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                                Hora
                              </label>
                              <input
                                type="time"
                                value={preview.without_time ? "" : preview.time}
                                onChange={(e) =>
                                  onUpdateTicketTime(preview.localId, preview.date, e.target.value)
                                }
                                className="h-7 w-full rounded-sm border border-[#8a8886] bg-white px-1.5 text-[11px] text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/30"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="mb-1.5 flex items-center gap-1 text-[#605e5c]">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            {preview.scheduleLabel}
                          </p>
                        )}

                        <p className="text-[#605e5c]">{preview.professionalName} · {preview.status}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-sm border border-dashed border-[#c8c6c4] bg-[#faf9f8] px-3 py-2 text-xs text-[#605e5c]">
                    Los tickets se generan al confirmar la venta.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {linkAppointmentId && (
          <div className="border-b border-[#edebe9] bg-[#eef6ff] px-4 py-3 text-xs text-[#004578]">
            Cobrando reserva #{linkAppointmentId}. No se duplicará la cita en agenda.
          </div>
        )}

        {/* Operaria */}
        <div className="border-b border-[#edebe9] px-4 py-4">
          <label className={labelClass} htmlFor="pos-drawer-seller">Operaria</label>
          <p className="mb-2 text-[11px] text-[#605e5c]">
            Se asignará a los tickets que aún no tengan operaria.
          </p>
          <div className="relative">
            <select
              id="pos-drawer-seller"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className={`${bcField} cursor-pointer appearance-none pr-8`}
            >
              <option value="">Seleccionar operaria...</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
          </div>
        </div>

        {/* Descuento + Método de pago + Notas */}
        <div className="space-y-4 border-b border-[#edebe9] px-4 py-4">
          <div>
            <label className={labelClass} htmlFor="pos-drawer-discount">Descuento</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                <input
                  id="pos-drawer-discount"
                  type="number"
                  min={0}
                  className={`${bcField} pl-9`}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="relative w-24">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                  className={`${bcField} cursor-pointer appearance-none pr-7 text-center`}
                >
                  <option value="amount">Bs</option>
                  <option value="percent">%</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#605e5c]" />
              </div>
            </div>
          </div>

          <div>
            <p className={labelClass}>Método de pago</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={`flex flex-col items-center gap-1 rounded-sm border px-1 py-2 text-[11px] font-semibold transition-colors ${
                    paymentMethod === value
                      ? "border-[#0078d4] bg-[#0078d4] text-white shadow-sm"
                      : "border-[#edebe9] bg-[#faf9f8] text-[#605e5c] hover:border-[#c8c6c4] hover:text-[#323130]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="pos-drawer-notes">Notas</label>
            <textarea
              id="pos-drawer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${bcField} resize-none py-2`}
              placeholder="Observaciones opcionales..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const panelFooter = (
    <div className="shrink-0 border-t border-[#edebe9] bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
        <span className="text-xs font-semibold text-[#605e5c]">Total a cobrar</span>
        <span className="text-lg font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span>
      </div>
      <button
        type="button"
        onClick={() => cartLines.forEach((l) => onRemoveLine(l.localId))}
        disabled={cartCount === 0 || isSubmitting}
        className={`mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-sm border text-sm font-semibold transition-all ${
          cartCount === 0
            ? "cursor-not-allowed border-[#edebe9] bg-[#f3f2f1] text-[#a19f9d]"
            : "border-[#f1bfc6] bg-[#fff4f5] text-[#a4262c] hover:bg-[#fde7e9]"
        }`}
      >
        <Trash2 className="h-4 w-4" />
        Vaciar carrito
      </button>
      {secondaryActionLabel && onSecondaryAction && (
        <button
          type="button"
          onClick={onSecondaryAction}
          disabled={isSubmitting}
          className="mb-2 flex h-10 w-full items-center justify-center rounded-sm border border-[#8a8886] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {secondaryActionLabel}
        </button>
      )}

      {/* Botón principal de cobro con hint de por qué está deshabilitado */}
      {primaryActionDisabled && !isSubmitting && (
        <p className="mb-1.5 rounded-sm bg-[#fff4ce] px-3 py-1.5 text-center text-[11px] font-medium text-[#8a6a1f]">
          {cartCount === 0
            ? "⚠ Agrega al menos un servicio"
            : !selectedClient
              ? "⚠ Selecciona un cliente para continuar"
              : "⚠ Completa los datos para continuar"}
        </p>
      )}
      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={primaryActionDisabled || isSubmitting}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-all ${
          primaryActionDisabled || isSubmitting
            ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
            : "bg-[#0078d4] text-white shadow-sm hover:bg-[#005a9e] active:bg-[#004578]"
        }`}
      >
        {isSubmitting ? "Procesando…" : primaryActionLabel}
      </button>
      <p className="mt-2 text-center text-[11px] text-[#605e5c]">{footerHint}</p>
    </div>
  );

  // ── Panel mode: columna fija en desktop ────────────────────────────────────
  if (isPanel) {
    return (
      <div className="flex h-full flex-col overflow-hidden border-l border-[#edebe9] bg-[#faf9f8]">
        {panelHeader}
        {panelBody}
        {panelFooter}
      </div>
    );
  }

  // ── Drawer mode: overlay deslizable ───────────────────────────────────────
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-43 bg-[#323130]/40 backdrop-blur-[1px]"
        aria-label="Cerrar panel de venta"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-45 flex h-full max-h-dvh w-full max-w-md flex-col border-l border-[#edebe9] bg-[#faf9f8] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-sale-drawer-title"
      >
        <div id="pos-sale-drawer-title" className="sr-only">Detalle de la venta</div>
        {panelHeader}
        {panelBody}
        {panelFooter}
      </div>
    </>
  );
}
