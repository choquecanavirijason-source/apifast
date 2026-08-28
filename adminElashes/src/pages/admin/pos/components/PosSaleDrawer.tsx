import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Layers, Plus, QrCode, Search, ShoppingCart, SplitSquareHorizontal, Tag, X, Trash2 } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type ServiceOption } from "../../../../core/services/agenda/agenda.service";
import type { MixedPaymentEntry } from "../../../../core/services/pos-sale/pos-sale.service";
import type { CartLine, PosCheckoutTicketPreview, PosSaleClientOption, ProductCartLine } from "../pos.types";
import { PAYMENT_METHODS } from "../pos.constants";

// Sección "Horario de tickets" (colapsable, encabezado "Horario · automático")
// desactivada a pedido — el código queda intacto por si se vuelve a necesitar,
// solo se oculta su render.
const SHOW_TICKET_SCHEDULE_SECTION = false;

type PosSaleDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  /** "drawer" (default) = overlay deslizable | "panel" = columna fija siempre visible en desktop */
  mode?: "drawer" | "panel";
  cartLines: CartLine[];
  productLines: ProductCartLine[];
  onUpdateProductQuantity: (localId: string, quantity: number) => void;
  onRemoveProductLine: (localId: string) => void;
  services: ServiceOption[];
  subtotal: number;
  total: number;
  onRemoveLine: (localId: string) => void;
  onChangeLineService: (localId: string, serviceId: string) => void;
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
  /** Solo pago 100% efectivo (no mixto): monto que entrega la clienta, para calcular el vuelto. */
  cashReceived?: string;
  setCashReceived?: (value: string) => void;
  mixedPayments: MixedPaymentEntry[];
  setMixedPayments: (value: MixedPaymentEntry[]) => void;
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
  /** Actualiza cualquier campo de una línea del carrito (sin_hora, etc.) */
  onUpdateCartLine?: (localId: string, patch: Partial<{ date: string; time: string; without_time: boolean; time_manual: boolean }>) => void;
  /** Mapa professionalId → hora en que termina su servicio actual. */
  professionalBusyUntilMap?: Map<string, string>;
  /** Aplica el sellerId actual a todos los tickets sin operaria asignada. */
  onApplySellerToAllLines?: () => void;
  /** Turno inmediato: crea tickets con hora actual sin abrir el planificador. */
  onImmediateCheckout?: (payLater: boolean, startService?: boolean) => void;
  /** URL de la imagen QR estático de pago de la sucursal. */
  branchQrImageUrl?: string | null;
};

export default function PosSaleDrawer({
  isOpen,
  onClose,
  cartLines,
  productLines,
  onUpdateProductQuantity,
  onRemoveProductLine,
  services,
  subtotal,
  total,
  onRemoveLine,
  onChangeLineService,
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
  cashReceived = "",
  setCashReceived,
  mixedPayments,
  setMixedPayments,
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
  ticketMode = "group",
  setTicketMode,
  onUpdateTicketTime,
  onUpdateCartLine,
  mode = "drawer",
  professionalBusyUntilMap = new Map(),
  onApplySellerToAllLines,
  onImmediateCheckout,
  branchQrImageUrl,
}: PosSaleDrawerProps) {
  const isPanel = mode === "panel";

  // Derived values needed by hooks — computed before any hook calls
  const cartCount = cartLines.length + productLines.length;
  const step1Done = cartCount > 0;
  const step2Done = !!selectedClient;
  const isMixedMode = mixedPayments.length > 0;
  const mixedTotal = mixedPayments.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cashReceivedValid = paymentMethod !== "cash" || (cashReceived.trim() !== "" && Number(cashReceived) >= total);
  const step3Done = isMixedMode ? mixedTotal > 0 : !!paymentMethod && cashReceivedValid;

  // All hooks must be declared before any conditional return (React Rules of Hooks)
  // Separa "Detalle de la venta" en pestañas (Servicios/Cliente/Pago) en vez de
  // un solo scroll largo — pensado para operarias sin mucha experiencia.
  const [activeStep, setActiveStep] = useState<"servicios" | "cliente" | "pago">("servicios");
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [isSellerOpen, setIsSellerOpen] = useState(false);
  const sellerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const [qrPendingAction, setQrPendingAction] = useState<(() => void) | null>(null);

  const openQrOverlay = (action: () => void) => {
    setQrPendingAction(() => action);
    setShowQrOverlay(true);
  };

  const closeQrOverlay = () => {
    setShowQrOverlay(false);
    setQrPendingAction(null);
  };

  const confirmQrPayment = () => {
    qrPendingAction?.();
    closeQrOverlay();
  };

  const [showSinHoraConfirm, setShowSinHoraConfirm] = useState(false);
  const [payLater, setPayLater] = useState(false);

  // Historial de la clienta: últimos servicios completados
  const [clientHistory, setClientHistory] = useState<Array<{ id: number; ticket_code: string | null; service_names: string[] | undefined; start_time: string }>>([]);

  useEffect(() => {
    if (!selectedClient) { setClientHistory([]); return; }
    AgendaService.listTickets({
      client_id: Number(selectedClient.id),
      status_filter: "completed",
      limit: 3,
    }).then((items) => {
      setClientHistory(items.map((t) => ({
        id: t.id,
        ticket_code: t.ticket_code,
        service_names: t.service_names,
        start_time: t.start_time,
      })));
    }).catch(() => setClientHistory([]));
  }, [selectedClient?.id]);

  // Datos del tutor para clientes menores de edad
  const [tutorNombre, setTutorNombre] = useState("");
  const [tutorCI, setTutorCI] = useState("");
  const [tutorTelefono, setTutorTelefono] = useState("");

  const clientAge = typeof selectedClient?.age === "number" ? selectedClient.age : null;
  const isMinorClient = clientAge !== null && clientAge < 18;
  const tutorDataComplete = !isMinorClient || (tutorNombre.trim() !== "" && tutorCI.trim() !== "");

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const ticketSummaryRef = useRef<HTMLDivElement | null>(null);
  const prevStep2Ref = useRef(step2Done);
  const prevStep3Ref = useRef(step3Done);

  // Limpiar datos del tutor cuando cambia el cliente
  useEffect(() => {
    setTutorNombre("");
    setTutorCI("");
    setTutorTelefono("");
  }, [selectedClient?.id]);

  // Al abrir el panel para una venta nueva, siempre arranca en "Servicios".
  useEffect(() => {
    if (isOpen) setActiveStep("servicios");
  }, [isOpen]);

  // Tras crear el turno / pasar a servicio, el carrito se vacía sin cerrar
  // el panel — vuelve a "Servicios" en vez de quedarse en "Pago".
  const prevCartCountRef = useRef(cartLines.length);
  useEffect(() => {
    if (cartLines.length === 0 && prevCartCountRef.current > 0) setActiveStep("servicios");
    prevCartCountRef.current = cartLines.length;
  }, [cartLines.length]);

  // No avanza sola de "Servicios" a "Cliente" al agregar el primer
  // servicio — quien vende puede querer seguir agregando más antes de pasar.

  useEffect(() => {
    if (step2Done && !prevStep2Ref.current) setActiveStep("pago");
    prevStep2Ref.current = step2Done;
  }, [step2Done]);

  useEffect(() => {
    if (!isSellerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(e.target as Node)) {
        setIsSellerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isSellerOpen]);

  const lineCountByServiceId = useMemo(() => {
    const counts = new Map<string, number>();
    cartLines.forEach((line) => {
      const key = String(line.service_id || "");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [cartLines]);

  // Agrupar líneas por service_id para mostrar una sola fila por servicio con cantidad
  const groupedCartLines = useMemo(() => {
    const groups = new Map<string, CartLine[]>();
    cartLines.forEach((line) => {
      const key = String(line.service_id || line.localId);
      const existing = groups.get(key) ?? [];
      groups.set(key, [...existing, line]);
    });
    return Array.from(groups.values());
  }, [cartLines]);

  // En modo drawer, si no está abierto no se renderiza
  if (!isOpen && !isPanel) return null;

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

  const stepBorder = (isDone: boolean, isActive: boolean) =>
    isDone
      ? "border-l-[3px] border-l-[#107c10]"
      : isActive
      ? "border-l-[3px] border-l-[#094732]"
      : "border-l-[3px] border-l-transparent";

  const labelClass = "mb-1 block text-xs font-semibold text-[#605e5c]";
  const bcField =
    "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

  // ── Contenido compartido (panel + drawer) ──────────────────────────────────
  const panelHeader = (
    <div className="flex shrink-0 items-center justify-between border-b border-[#edebe9] bg-white px-4 py-3">
      <div className="min-w-0 pr-2">
        <p className="text-base font-semibold text-[#323130]">
          {isPanel ? "Resumen de venta" : "Detalle de la venta"}
        </p>
        <p className="truncate text-xs text-[#605e5c]">
          {cartCount} ítem(s) · Total Bs {total.toFixed(2)}
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

  const panelProgress = (
    <div className="shrink-0 flex items-center gap-0 border-b border-[#edebe9] bg-[#f3f2f1]">
      {([
        { key: "servicios", label: "Servicios", done: step1Done, active: activeStep === "servicios" },
        { key: "cliente", label: "Cliente", done: step2Done, active: activeStep === "cliente" },
        { key: "pago", label: "Pago", done: step3Done, active: activeStep === "pago" },
      ] as { key: "servicios" | "cliente" | "pago"; label: string; done: boolean; active: boolean }[]).map((step, i) => (
        <button
          key={step.key}
          type="button"
          onClick={() => setActiveStep(step.key)}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold border-r last:border-r-0 border-[#edebe9] transition-colors ${
            step.active ? "bg-white" : "hover:bg-white/60"
          } ${
            step.done ? "text-[#107c10]" : step.active ? "text-[#094732]" : "text-[#a19f9d]"
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              step.done
                ? "bg-[#107c10] text-white"
                : step.active
                ? "bg-[#094732] text-white"
                : "bg-[#edebe9] text-[#605e5c]"
            }`}
          >
            {step.done ? "✓" : i + 1}
          </span>
          {step.label}
        </button>
      ))}
    </div>
  );

  const panelBody = (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-white">

      {/* ── Carrito ─────────────────────────────────────────────────────────── */}
      {activeStep === "servicios" && (
      <div className={`border-b border-[#edebe9] ${stepBorder(step1Done, !step1Done)}`}>
        <div className={`flex items-center gap-2 px-4 py-3 ${!step1Done ? "bg-[#fff4ce]" : "bg-[#faf9f8]"}`}>
          <ShoppingCart className={`h-4 w-4 ${!step1Done ? "text-[#8a6a1f]" : "text-[#094732]"}`} />
          <span className="text-sm font-semibold text-[#323130]">Servicios ({cartLines.length})</span>
          {!step1Done && <span className="ml-auto text-[10px] font-semibold text-[#8a6a1f]">Requerido</span>}
        </div>

        {/* Lista del carrito */}
        <div className="px-0">
          {cartCount === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-[#605e5c]">
              <ShoppingCart className="mb-3 h-9 w-9 opacity-20" />
              <p className="text-sm italic">Agrega servicios o productos desde el catálogo</p>
            </div>
          ) : (
            <>
              {cartLines.length > 0 && (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#edebe9] bg-[#faf9f8] text-[11px] font-semibold uppercase text-[#605e5c]">
                      <th className="px-4 py-2">Servicio</th>
                      <th className="px-4 py-2 text-right">Precio</th>
                      <th className="w-10 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f2f1]">
                    {groupedCartLines.map((group, groupIdx) => {
                      const repLine = group[0];
                      const count = group.length;
                      const groupTotal = group.reduce((s, l) => s + l.price, 0);
                      return (
                        <tr key={repLine.localId} className="transition-colors hover:bg-[#f3f2f1]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-[11px] text-[#a19f9d]">{groupIdx + 1}.</span>
                              <select
                                value={repLine.service_id}
                                onChange={(e) => {
                                  // Actualizar todas las líneas del grupo al nuevo servicio
                                  group.forEach((l) => onChangeLineService(l.localId, e.target.value));
                                }}
                                className="h-9 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#094732] focus:ring-1 focus:ring-[#094732]/35"
                              >
                                <option value="">Servicio...</option>
                                {services.map((s) => (
                                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                                ))}
                              </select>
                              {count > 1 && (
                                <span className="shrink-0 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-bold text-[#094732]">
                                  x{count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-[#323130]">
                            Bs {groupTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onRemoveLine(group[group.length - 1].localId)}
                              className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                              aria-label="Quitar una unidad"
                              title={count > 1 ? `Quitar 1 de ${count}` : "Quitar servicio"}
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

              {productLines.length > 0 && (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#edebe9] bg-[#faf9f8] text-[11px] font-semibold uppercase text-[#605e5c]">
                      <th className="px-4 py-2">Producto</th>
                      <th className="w-24 px-4 py-2 text-center">Cant.</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                      <th className="w-10 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f2f1]">
                    {productLines.map((line) => (
                      <tr key={line.localId} className="transition-colors hover:bg-[#f3f2f1]">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-[#323130]">{line.name}</p>
                          <p className="text-[11px] text-[#605e5c]">Bs {line.unit_price.toFixed(2)} c/u</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onUpdateProductQuantity(line.localId, line.quantity - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d2d0ce] text-xs font-bold text-[#323130] hover:bg-[#f3f2f1]"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-[#094732]">{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => onUpdateProductQuantity(line.localId, line.quantity + 1)}
                              disabled={line.quantity >= line.availableStock}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#d2d0ce] text-xs font-bold text-[#323130] hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[#323130]">
                          Bs {(line.unit_price * line.quantity).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onRemoveProductLine(line.localId)}
                            className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                            aria-label="Quitar producto"
                            title="Quitar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <div className="border-t border-[#edebe9] bg-[#faf9f8] px-4 py-3 text-center text-xs text-[#605e5c]">
          Subtotal: <span className="font-semibold text-[#323130]">Bs {subtotal.toFixed(2)}</span>
          {total !== subtotal && (
            <> · Con descuento: <span className="font-bold text-[#094732]">Bs {total.toFixed(2)}</span></>
          )}
        </div>

        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveStep("cliente")}
            disabled={!step1Done}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-sm bg-[#094732] text-sm font-semibold text-white transition hover:bg-[#063324] disabled:cursor-not-allowed disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
          >
            Siguiente: Cliente
          </button>
        </div>
      </div>
      )}

      {activeStep === "cliente" && (
      <div className="pb-4">
        {/* Cliente */}
        <div className="relative">
        <div
          className={`border-b px-4 py-4 border-[#edebe9] ${stepBorder(step2Done, step1Done && !step2Done)} ${step1Done && !step2Done ? "bg-[#ecfdf5]" : ""} transition-[filter,opacity] duration-200 ${!step1Done ? "blur-[3px] opacity-40 pointer-events-none select-none" : ""}`}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step2Done ? "bg-[#107c10] text-white" : "bg-[#d13438] text-white"}`}>
              {step2Done ? "✓" : "2"}
            </span>
            <p className="text-xs font-semibold text-[#323130]">Cliente <span className="text-[#605e5c] font-normal">(opcional)</span></p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1" ref={clientComboboxRef}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
              <input
                value={clientSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setClientSearch(val);
                  if (selectedClient) {
                    const fullName = `${selectedClient.nombre} ${selectedClient.apellido}`.trim();
                    if (val !== fullName) setClientId("");
                  } else {
                    setClientId("");
                  }
                  setIsClientMenuOpen(true);
                }}
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
                        const isSelected = String(selectedClient?.id) === String(client.id);
                        const isActive = client.status === "en_espera" || client.status === "en_servicio";
                        const statusLabel = client.status === "en_servicio" ? "En servicio" : client.status === "en_espera" ? "En espera" : null;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setClientId(String(client.id));
                              setClientSearch(fullName);
                              setIsClientMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1] ${isSelected ? "bg-[#ecfdf5]" : ""}`}
                          >
                            <span className={`truncate ${isSelected ? "font-semibold text-[#094732]" : "text-[#323130]"}`}>{fullName}</span>
                            <div className="ml-3 flex shrink-0 items-center gap-2">
                              {isSelected && <span className="text-[10px] font-bold text-[#094732]">✓</span>}
                              {isActive && statusLabel && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  client.status === "en_servicio"
                                    ? "bg-[#dff6dd] text-[#107c10]"
                                    : "bg-[#fff4ce] text-[#8a6a1f]"
                                }`}>
                                  {statusLabel}
                                </span>
                              )}
                              <span className="text-xs text-[#605e5c]">{client.phone || "Sin tel."}</span>
                            </div>
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
              title="Registrar nueva clienta"
              className="flex h-9 flex-none items-center gap-1.5 rounded-sm bg-[#094732] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#063324] active:bg-[#094732]"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>
          {!selectedClient && step1Done && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#605e5c]">
              Sin elegir: la venta queda a nombre de "Cliente Mostrador"
            </p>
          )}
          {/* Historial reciente de la clienta */}
          {selectedClient && clientHistory.length > 0 && (
            <div className="mt-3 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                Últimas visitas
              </p>
              <ul className="space-y-1.5">
                {clientHistory.map((h) => {
                  const date = new Date(h.start_time);
                  const dateLabel = Number.isNaN(date.getTime())
                    ? "—"
                    : date.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
                  const svcLabel = h.service_names?.join(", ") ?? "—";
                  return (
                    <li key={h.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="truncate text-[#323130]">{svcLabel}</span>
                      <span className="shrink-0 text-[#a19f9d]">{dateLabel}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
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
        </div>

        {/* ── Formulario de autorización para cliente menor de edad ──────── */}
        {isMinorClient && selectedClient && (
          <div className="border-b border-[#edebe9] bg-[#fff4ce] px-4 py-3">
            <p className="mb-1 text-xs font-bold text-[#8a6a1f]">
              ⚠ Clienta menor de edad ({clientAge} años) — autorización del tutor requerida
            </p>
            <p className="mb-3 text-[11px] text-[#605e5c]">
              Completa los datos del tutor o responsable legal antes de crear el ticket.
            </p>
            <div className="space-y-2">
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  Nombre del tutor <span className="text-[#d13438]">*</span>
                </label>
                <input
                  type="text"
                  value={tutorNombre}
                  onChange={(e) => setTutorNombre(e.target.value)}
                  placeholder="Nombre completo del tutor o responsable"
                  className={bcField}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    CI / DNI <span className="text-[#d13438]">*</span>
                  </label>
                  <input
                    type="text"
                    value={tutorCI}
                    onChange={(e) => setTutorCI(e.target.value)}
                    placeholder="Número de CI"
                    className={bcField}
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={tutorTelefono}
                    onChange={(e) => setTutorTelefono(e.target.value)}
                    placeholder="Teléfono del tutor"
                    className={bcField}
                  />
                </div>
              </div>
              {!tutorDataComplete && (
                <p className="text-[11px] font-semibold text-[#d13438]">
                  ⛔ Nombre y CI del tutor son obligatorios para continuar.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveStep("servicios")}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm border border-[#8a8886] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1]"
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={() => setActiveStep("pago")}
            disabled={!tutorDataComplete}
            className="flex h-10 flex-2 items-center justify-center gap-1.5 rounded-sm bg-[#094732] text-sm font-semibold text-white transition hover:bg-[#063324] disabled:cursor-not-allowed disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
          >
            Siguiente: Pago
          </button>
        </div>
      </div>
      )}

      {activeStep === "pago" && (
      <div className="pb-4">
        {/* Tickets + Operaria + Pago */}
        <div>
        <div>

        {linkAppointmentId && (
          <div className="border-b border-[#edebe9] bg-[#ecfdf5] px-4 py-3 text-xs text-[#094732]">
            Cobrando reserva #{linkAppointmentId}. No se duplicará la cita en agenda.
          </div>
        )}

        {/* Toggle ticket Individual / Grupal */}
        {cartLines.length > 1 && !linkAppointmentId && setTicketMode && (
          <div className="border-b border-[#edebe9] px-4 py-3">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#201f1e]">Modo de ticket</p>
            <div className="flex overflow-hidden rounded-sm border border-[#edebe9]">
              <button
                type="button"
                onClick={() => setTicketMode("individual")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors ${ticketMode === "individual" ? "bg-[#094732] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
              >
                <SplitSquareHorizontal className="h-3.5 w-3.5" />
                Separados
              </button>
              <button
                type="button"
                onClick={() => setTicketMode("group")}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors ${ticketMode === "group" ? "bg-[#094732] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
              >
                <Layers className="h-3.5 w-3.5" />
                Junto
              </button>
            </div>
          </div>
        )}

        {/* Operaria */}
        {(() => {
          const selectedPro = professionals.find((p) => String(p.id) === sellerId);
          const isBusy = selectedPro?.is_busy === true;
          const hasActiveToday = (selectedPro?.active_count_today ?? 0) > 0;
          return (
            <div className={`border-b border-[#edebe9] px-4 py-4 ${stepBorder(step3Done, step2Done && !step3Done)}`}>
              <label className="mb-2 block text-[13px] font-bold uppercase tracking-wide text-[#201f1e]">Operaria</label>
              <div className="relative" ref={sellerDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSellerOpen((o) => !o)}
                  className={`${bcField} flex cursor-pointer items-center justify-between pr-8 text-left ${isBusy ? "border-[#d13438] bg-[#fff4f5]" : ""}`}
                >
                  {selectedPro ? (
                    <span className={`flex items-center gap-2 ${isBusy ? "text-[#a19f9d] line-through" : "text-[#323130]"}`}>
                      {selectedPro.username}
                      {isBusy && <span className="text-[11px] font-semibold text-[#d13438] no-underline not-line-through ml-1">(ocupada)</span>}
                    </span>
                  ) : (
                    <span className="text-[#605e5c]">Seleccionar operaria...</span>
                  )}
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                </button>

                {isSellerOpen && (
                  <div className="absolute z-70 mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                    <div className="max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        onClick={() => { setSellerId(""); setIsSellerOpen(false); }}
                        className="flex w-full items-center px-3 py-2 text-sm text-[#605e5c] transition hover:bg-[#f3f2f1]"
                      >
                        Sin operaria asignada
                      </button>
                      {professionals.map((p) => {
                        const inService = p.is_busy === true;
                        const hasPending = !inService && (p.active_count_today ?? 0) > 0;
                        const freeAt = p.busy_until_time ?? professionalBusyUntilMap.get(String(p.id));
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSellerId(String(p.id)); setIsSellerOpen(false); }}
                            title={inService ? "Ocupada ahora — se puede igual poner en su cola con \"Crear turno\"" : undefined}
                            className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${
                              String(p.id) === sellerId
                                ? "bg-[#ecfdf5]"
                                : "hover:bg-[#f3f2f1]"
                            }`}
                          >
                            <span className={`flex items-center gap-2 ${inService ? "line-through text-[#a19f9d]" : "text-[#323130]"}`}>
                              {p.username}
                            </span>
                            <div className="flex shrink-0 items-center gap-2 ml-2">
                              {inService ? (
                                <span className="rounded-full bg-[#fde7e9] px-2 py-0.5 text-[10px] font-bold text-[#d13438]">
                                  {freeAt ? `⛔ En servicio · libre ~${freeAt}` : "⛔ En servicio"}
                                </span>
                              ) : hasPending ? (
                                <span className="rounded-full bg-[#fff4ce] px-2 py-0.5 text-[10px] font-bold text-[#8a6a1f]" title={freeAt ? `Termina ~${freeAt}` : ""}>
                                  {p.active_count_today} turno{(p.active_count_today ?? 0) > 1 ? "s" : ""}
                                  {freeAt ? ` · libre ~${freeAt}` : ""}
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#dff6dd] px-2 py-0.5 text-[10px] font-bold text-[#107c10]">
                                  ✓ Libre
                                </span>
                              )}
                              {p.is_temp_assigned && (
                                <span className="rounded-full bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-bold text-[#094732]" title={`Temporal hasta ${p.temp_branch_until ?? ""}`}>
                                  ⚡ Temp.
                                </span>
                              )}
                              {String(p.id) === sellerId && (
                                <span className="text-[10px] font-bold text-[#094732]">●</span>
                              )}
                              {p.branch_name && (
                                <span className="text-[11px] text-[#a19f9d]">
                                  {p.is_temp_assigned && p.temp_branch_name ? p.temp_branch_name : p.branch_name}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isBusy && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#d13438]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  En servicio ahora. Espera a que termine o elige otra.
                  {selectedPro?.busy_until_time && ` Libre ~${selectedPro.busy_until_time}`}
                </p>
              )}
              {!isBusy && hasActiveToday && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#8a6a1f]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Tiene {selectedPro?.active_count_today} turno(s) pendiente(s) hoy
                  {selectedPro?.busy_until_time ? ` · libre ~${selectedPro.busy_until_time}` : ""}.
                </p>
              )}
              {/* Botón para propagar operaria a todos los tickets sin asignar */}
              {sellerId && !isBusy && onApplySellerToAllLines && cartCount > 0 && (
                <button
                  type="button"
                  onClick={onApplySellerToAllLines}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-[#094732] bg-[#ecfdf5] py-1.5 text-[11px] font-semibold text-[#094732] transition hover:bg-[#ecfdf5]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Asignar a todos los tickets sin operaria →
                </button>
              )}
            </div>
          );
        })()}

        {/* Descuento + Método de pago + Notas */}
        <div className={`space-y-4 border-b border-[#edebe9] px-4 py-4 ${stepBorder(step3Done, step2Done && !step3Done)} ${step2Done && !step3Done ? "bg-[#fffdf5]" : ""}`}>
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
                  onWheel={(e) => e.currentTarget.blur()}
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
            {(() => {
              const d = parseFloat(discountValue) || 0;
              const applied = discountType === "percent" ? subtotal * (d / 100) : d;
              return applied > 0 && applied >= subtotal ? (
                <p className="mt-1 text-[11px] font-semibold text-[#d13438]">
                  ⚠ El descuento no puede igualar o superar el subtotal (Bs {subtotal.toFixed(2)})
                </p>
              ) : null;
            })()}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step3Done ? "bg-[#107c10] text-white" : "bg-[#8a6a1f] text-white"}`}>
                {step3Done ? "✓" : "3"}
              </span>
              <p className="text-[13px] font-bold uppercase tracking-wide text-[#201f1e]">Método de pago <span className="text-[#d13438]">*</span></p>
              {!step3Done && step1Done && (
                <span className="ml-auto text-[10px] font-semibold text-[#8a6a1f]">Requerido</span>
              )}
            </div>

            {/* Toggle simple / mixto */}
            <div className="mb-2 flex rounded-sm border border-[#edebe9] overflow-hidden">
              <button
                type="button"
                onClick={() => { setMixedPayments([]); }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold transition-colors ${!isMixedMode ? "bg-[#094732] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
              >
                <SplitSquareHorizontal className="h-3.5 w-3.5" /> Simple
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isMixedMode) {
                    setMixedPayments([{ method: "cash", amount: 0 }, { method: "card", amount: 0 }]);
                  }
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold transition-colors ${isMixedMode ? "bg-[#094732] text-white" : "bg-[#faf9f8] text-[#605e5c] hover:bg-[#f3f2f1]"}`}
              >
                <Layers className="h-3.5 w-3.5" /> Mixto
              </button>
            </div>

            {/* Pago simple */}
            {!isMixedMode && (
              <>
                <div className={`grid grid-cols-2 gap-1.5 sm:grid-cols-4 ${!step3Done && step1Done ? "rounded-sm ring-2 ring-[#f0c477] ring-offset-1" : ""}`}>
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex flex-col items-center gap-1 rounded-sm border px-1 py-2 text-[11px] font-semibold transition-colors ${
                        paymentMethod === value
                          ? "border-[#094732] bg-[#094732] text-white shadow-sm"
                          : "border-[#edebe9] bg-[#faf9f8] text-[#605e5c] hover:border-[#c8c6c4] hover:text-[#323130]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Efectivo: monto recibido + vuelto */}
                {paymentMethod === "cash" && setCashReceived && (
                  <div className="mt-2 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2.5">
                    <label className={labelClass} htmlFor="pos-drawer-cash-received">
                      Monto recibido en efectivo
                    </label>
                    <input
                      id="pos-drawer-cash-received"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={`Bs ${total.toFixed(2)}`}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-9 w-full rounded-sm border border-[#c8c6c4] bg-white px-2.5 text-sm text-[#323130] outline-none focus:border-[#094732] focus:ring-1 focus:ring-[#094732]"
                    />
                    {cashReceived.trim() !== "" && (() => {
                      const received = Number(cashReceived);
                      if (!Number.isFinite(received)) return null;
                      const change = received - total;
                      return change >= 0 ? (
                        <p className="mt-1.5 flex items-center justify-between text-xs font-bold text-[#094732]">
                          <span>Vuelto a entregar</span>
                          <span>Bs {change.toFixed(2)}</span>
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs font-semibold text-[#a4262c]">
                          Faltan Bs {Math.abs(change).toFixed(2)} para cubrir el total.
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Info QR */}
                {paymentMethod === "qr" && branchQrImageUrl && (
                  <div className="mt-2 flex items-center gap-2 rounded-sm border border-[#c8e6d9] bg-[#ecfdf5] px-3 py-2">
                    <QrCode className="h-3.5 w-3.5 shrink-0 text-[#094732]" />
                    <p className="text-[11px] font-medium text-[#094732]">
                      Al confirmar el cobro se mostrará el QR para que el cliente escanee y pague.
                    </p>
                  </div>
                )}
                {paymentMethod === "qr" && !branchQrImageUrl && (
                  <p className="mt-1.5 rounded-sm bg-[#fff4ce] px-3 py-1.5 text-[11px] font-medium text-[#8a6a1f]">
                    Sin imagen QR configurada. Ve a Salones → editar sucursal para agregar el QR de pago.
                  </p>
                )}
              </>
            )}

            {/* Pago mixto */}
            {isMixedMode && (
              <div className="space-y-2">
                {mixedPayments.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={entry.method}
                      onChange={(e) => {
                        const next = [...mixedPayments];
                        next[idx] = { ...entry, method: e.target.value };
                        setMixedPayments(next);
                      }}
                      className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-[11px] font-semibold text-[#323130] outline-none focus:border-[#094732]"
                    >
                      {PAYMENT_METHODS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#605e5c]">Bs</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={entry.amount || ""}
                        placeholder="0.00"
                        onChange={(e) => {
                          const next = [...mixedPayments];
                          next[idx] = { ...entry, amount: Number(e.target.value) };
                          setMixedPayments(next);
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full rounded-sm border border-[#edebe9] bg-white py-1.5 pl-7 pr-2 text-[11px] text-[#323130] outline-none focus:border-[#094732]"
                      />
                    </div>
                    {mixedPayments.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setMixedPayments(mixedPayments.filter((_, i) => i !== idx))}
                        className="rounded-sm p-1 text-[#a19f9d] hover:bg-[#fde7e9] hover:text-[#d13438]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setMixedPayments([...mixedPayments, { method: "cash", amount: 0 }])}
                  className="flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-[#c8c6c4] py-1.5 text-[11px] font-semibold text-[#605e5c] hover:border-[#094732] hover:text-[#094732]"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar método
                </button>

                {/* Resumen mixto */}
                <div className={`flex items-center justify-between rounded-sm border px-3 py-1.5 text-[11px] font-semibold ${
                  mixedTotal >= total
                    ? "border-[#a3d7a4] bg-[#f1fbf1] text-[#107c10]"
                    : "border-[#f0c477] bg-[#fff4ce] text-[#8a6a1f]"
                }`}>
                  <span>Total pagado: Bs {mixedTotal.toFixed(2)}</span>
                  {mixedTotal >= total
                    ? <span>Vuelto: Bs {(mixedTotal - total).toFixed(2)}</span>
                    : <span>Falta: Bs {(total - mixedTotal).toFixed(2)}</span>
                  }
                </div>
              </div>
            )}
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

        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setActiveStep("cliente")}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-sm border border-[#8a8886] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1]"
          >
            Atrás
          </button>
        </div>
      </div>
      )}

    </div>
  );

  const panelFooter = (
    <div className="shrink-0 border-t border-[#edebe9] bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">

      {/* ── Horario de tickets (colapsable) ── */}
      {SHOW_TICKET_SCHEDULE_SECTION && cartCount > 0 && onUpdateTicketTime && (
        <div className="border-b border-[#edebe9]">
          <button
            type="button"
            onClick={() => setTicketsOpen((v) => !v)}
            className="flex w-full items-center gap-1.5 px-4 py-1.5 text-left hover:bg-[#f3f2f1] transition-colors"
          >
            <CalendarClock className="h-3 w-3 shrink-0 text-[#a19f9d]" />
            <span className="flex-1 text-[10px] text-[#a19f9d]">
              {cartLines.some((l) => l.time_manual) ? "Horario · con hora fija" : "Horario · automático"}
            </span>
            {ticketsOpen
              ? <ChevronUp className="h-2.5 w-2.5 text-[#a19f9d]" />
              : <ChevronDown className="h-2.5 w-2.5 text-[#a19f9d]" />}
          </button>

          {ticketsOpen && (
            <div className="divide-y divide-[#f3f1ec] border-t border-[#edebe9] bg-[#fafafa]">
              {cartLines.map((line, idx) => {
                const svcName = services.find((s) => String(s.id) === line.service_id)?.name ?? `Servicio ${idx + 1}`;
                const today = new Date().toISOString().slice(0, 10);
                return (
                  <div key={line.localId} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-[10px] font-semibold text-[#094732]">#{idx + 1}</span>
                      <span className="flex-1 truncate text-[10px] text-[#605e5c]">{svcName}</span>
                      <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#a19f9d]">
                        <input
                          type="checkbox"
                          checked={line.without_time}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdateCartLine?.(line.localId, { without_time: checked, time_manual: false });
                          }}
                          className="h-3 w-3 accent-[#094732]"
                        />
                        Sin hora
                      </label>
                      <button
                        type="button"
                        onClick={() => onUpdateTicketTime(line.localId, today, new Date().toTimeString().slice(0, 5))}
                        className="text-[10px] text-[#a19f9d] hover:text-[#094732]"
                      >
                        Ahora
                      </button>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="date"
                        value={line.date || today}
                        onChange={(e) => onUpdateTicketTime(line.localId, e.target.value, line.time || "09:00")}
                        className="flex-1 rounded-sm border border-[#edebe9] bg-white px-2 py-1 text-[10px] text-[#323130] outline-none focus:border-[#094732]"
                      />
                      <input
                        type="time"
                        value={line.without_time ? "" : (line.time || "")}
                        disabled={line.without_time}
                        onChange={(e) => onUpdateTicketTime(line.localId, line.date || today, e.target.value)}
                        className="w-24 rounded-sm border border-[#edebe9] bg-white px-2 py-1 text-[10px] text-[#323130] outline-none focus:border-[#094732] disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-2">
      {/* Total */}
      <div className="mb-1.5 flex items-center justify-between rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2.5 py-1.5">
        <span className="text-[13px] font-bold uppercase tracking-wide text-[#201f1e]">Total a cobrar</span>
        <span className="text-base font-bold text-[#094732]">Bs {total.toFixed(2)}</span>
      </div>

      {/* Vaciar carrito */}
      <button
        type="button"
        onClick={() => cartLines.forEach((l) => onRemoveLine(l.localId))}
        disabled={cartCount === 0 || isSubmitting}
        className={`mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border text-xs font-semibold transition-all ${
          cartCount === 0
            ? "cursor-not-allowed border-[#edebe9] bg-[#f3f2f1] text-[#a19f9d]"
            : "border-[#f1bfc6] bg-[#fff4f5] text-[#a4262c] hover:bg-[#fde7e9]"
        }`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Vaciar carrito
      </button>

      {/* ── Modo WALK-IN: pago siempre al momento ───────────────────────── */}
      {onImmediateCheckout && !linkAppointmentId ? ((() => {
        // "Pasar a servicio" arranca la atención ya mismo — sin operaria
        // asignada (línea por línea o con el selector general de arriba) no
        // tiene sentido dejarlo pasar, quedaría "en servicio" sin nadie. Si
        // la operaria elegida está ocupada tampoco puede arrancar ya mismo
        // (para eso está "Crear turno", que la deja en su cola).
        const missingSellerForService = cartLines.some((l) => {
          const effectiveId = l.professional_id || sellerId;
          if (!effectiveId) return true;
          const pro = professionals.find((p) => String(p.id) === effectiveId);
          return pro?.is_busy === true;
        });
        return (
        <>
          {/* Validación */}
          {(cartCount === 0 || !tutorDataComplete || !step3Done) && (
            <p className="mb-1.5 rounded-sm bg-[#fff4ce] px-2.5 py-1 text-center text-[10px] font-medium text-[#8a6a1f]">
              {cartCount === 0
                ? "Agrega al menos un servicio"
                : !tutorDataComplete
                  ? "Completa los datos del tutor (cliente menor)"
                  : isMixedMode
                    ? "Ingresa los montos del pago mixto"
                    : !paymentMethod
                      ? "Selecciona método de pago"
                      : "Ingresa el monto recibido en efectivo"}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={cartCount === 0 || !step3Done || !tutorDataComplete || isSubmitting}
              onClick={() => {
                if (!isMixedMode && paymentMethod === "qr" && branchQrImageUrl) {
                  openQrOverlay(() => onImmediateCheckout(false));
                } else {
                  onImmediateCheckout(false);
                }
              }}
              className={`flex h-9 flex-1 items-center justify-center rounded-sm text-xs font-semibold transition-all ${
                cartCount === 0 || !step3Done || !tutorDataComplete || isSubmitting
                  ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
                  : "bg-[#107c10] text-white hover:bg-[#0b5e0b]"
              }`}
            >
              {isSubmitting ? "Procesando…" : !isMixedMode && paymentMethod === "qr" && branchQrImageUrl ? "Ver QR y cobrar" : "Crear turno"}
            </button>
            <button
              type="button"
              disabled={cartCount === 0 || !step3Done || !tutorDataComplete || missingSellerForService || isSubmitting}
              onClick={() => onImmediateCheckout(false, true)}
              className={`flex h-9 flex-1 items-center justify-center rounded-sm text-xs font-semibold transition-all ${
                cartCount === 0 || !step3Done || !tutorDataComplete || missingSellerForService || isSubmitting
                  ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
                  : "bg-[#094732] text-white hover:bg-[#063324]"
              }`}
            >
              {isSubmitting ? "Procesando…" : "Pasar a servicio"}
            </button>
          </div>
        </>
        );
      })()) : (
        /* ── Modo RESERVA / COBRO EXISTENTE: botón único original ─────── */
        <>
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              disabled={isSubmitting}
              className="mb-2 flex h-9 w-full items-center justify-center rounded-sm border border-[#8a8886] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {secondaryActionLabel}
            </button>
          )}

          {/* Confirmación de tickets sin hora asignada */}
          {showSinHoraConfirm && (
            <div className="mb-3 overflow-hidden rounded-sm border border-[#fff4ce] bg-[#fffbf0]">
              <div className="flex items-start gap-2 border-b border-[#fff4ce] px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6a1f]" />
                <div>
                  <p className="text-xs font-bold text-[#323130]">Tickets sin hora asignada</p>
                  <p className="mt-0.5 text-[11px] text-[#605e5c]">
                    {ticketPreviews.filter((p) => p.scheduleLabel?.includes("Sin hora")).length} ticket(s) sin hora. ¿Confirmar igual?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 px-3 py-2">
                <button type="button" onClick={() => {
                    setShowSinHoraConfirm(false);
                    if (!isMixedMode && paymentMethod === "qr" && branchQrImageUrl) {
                      openQrOverlay(onPrimaryAction);
                    } else {
                      onPrimaryAction();
                    }
                  }}
                  className="flex-1 rounded-sm bg-[#8a6a1f] py-1.5 text-xs font-semibold text-white hover:bg-[#6d5218]">
                  Confirmar igual
                </button>
                <button type="button" onClick={() => setShowSinHoraConfirm(false)}
                  className="flex-1 rounded-sm border border-[#edebe9] bg-white py-1.5 text-xs font-semibold text-[#323130] hover:bg-[#f3f2f1]">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Botón principal de cobro (modo reserva) */}
          {!showSinHoraConfirm && (() => {
        const sellerPro = professionals.find((p) => String(p.id) === sellerId);
        const sellerBusy = sellerPro?.is_busy === true;
        const isDisabled = primaryActionDisabled || sellerBusy || !tutorDataComplete;
        const sinHoraCount = ticketPreviews.filter((p) => p.scheduleLabel?.includes("Sin hora")).length;
        const doCheckout = () => {
          if (!isMixedMode && paymentMethod === "qr" && branchQrImageUrl) {
            openQrOverlay(onPrimaryAction);
          } else {
            onPrimaryAction();
          }
        };
        const handleClick = () => {
          if (!isDisabled && sinHoraCount > 0) {
            setShowSinHoraConfirm(true);
          } else {
            doCheckout();
          }
        };
        return (
          <>
            {isDisabled && !isSubmitting && (
              <p className={`mb-1.5 rounded-sm px-3 py-1.5 text-center text-[11px] font-medium ${sellerBusy ? "bg-[#fde7e9] text-[#d13438]" : "bg-[#fff4ce] text-[#8a6a1f]"}`}>
                {sellerBusy
                  ? "⛔ La operaria seleccionada está ocupada. Espera o elige otra."
                  : cartCount === 0
                    ? "⚠ Paso 1: Agrega al menos un servicio o producto"
                    : !step3Done
                      ? isMixedMode
                        ? "⚠ Paso 3: Ingresa los montos del pago mixto"
                        : "⚠ Paso 3: Selecciona un método de pago"
                      : "⚠ Completa los datos para continuar"}
              </p>
            )}
            {!isDisabled && sinHoraCount > 0 && !isSubmitting && (
              <p className="mb-1.5 flex items-center gap-1 rounded-sm bg-[#fff4ce] px-3 py-1.5 text-[11px] font-medium text-[#8a6a1f]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {sinHoraCount} ticket(s) sin hora — se pedirá confirmación
              </p>
            )}
            <button
              type="button"
              onClick={handleClick}
              disabled={isDisabled || isSubmitting}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-all ${
                isDisabled || isSubmitting
                  ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]"
                  : "bg-[#094732] text-white shadow-sm hover:bg-[#063324] active:bg-[#094732]"
              }`}
            >
              {isSubmitting ? "Procesando…" : primaryActionLabel}
            </button>
          </>
        );
          })()}
          <p className="mt-2 text-center text-[11px] text-[#605e5c]">{footerHint}</p>
        </>
      )}
      </div>
    </div>
  );

  // ── Overlay fullscreen QR ────────────────────────────────────────────────
  const qrOverlay = showQrOverlay && branchQrImageUrl ? (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-4">
      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex w-full items-center justify-between">
          <p className="text-base font-bold text-[#323130]">Pago con QR</p>
          <button
            type="button"
            onClick={closeQrOverlay}
            className="rounded-full p-1.5 text-[#605e5c] transition hover:bg-[#f3f2f1]"
            aria-label="Cancelar pago QR"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Total prominente */}
        <div className="w-full rounded-xl border-2 border-[#094732] bg-[#ecfdf5] py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Total a cobrar</p>
          <p className="mt-0.5 text-3xl font-black text-[#094732]">Bs {total.toFixed(2)}</p>
        </div>

        {/* QR image */}
        <img
          src={branchQrImageUrl}
          alt="QR de pago"
          className="h-56 w-56 rounded-xl border border-[#edebe9] object-contain bg-white p-2 shadow-sm"
        />

        <p className="text-center text-xs text-[#605e5c]">
          Muestra este QR al cliente, espera que escanee y pague,<br />
          luego presiona <strong>Pago recibido</strong>.
        </p>

        {/* Acciones */}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={closeQrOverlay}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#edebe9] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1]"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmQrPayment}
            disabled={isSubmitting}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition ${
              isSubmitting ? "cursor-not-allowed bg-[#a19f9d]" : "bg-[#107c10] hover:bg-[#0b5e0b]"
            }`}
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSubmitting ? "Procesando…" : "Pago recibido ✓"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Panel mode: columna fija en desktop ────────────────────────────────────
  if (isPanel) {
    return (
      <>
        {qrOverlay}
        <div className="flex h-full flex-col overflow-hidden border-l border-[#edebe9] bg-[#faf9f8]">
          {panelHeader}
          {panelBody}
          {panelFooter}
        </div>
      </>
    );
  }

  // ── Drawer mode: overlay deslizable ───────────────��───────────────────────
  return (
    <>
      {qrOverlay}
      {/* Sin fondo bloqueante: el carrito queda abierto mientras se sigue
          agregando servicios desde la izquierda — se cierra solo con la X. */}
      <div
        className="fixed right-0 top-0 z-45 flex h-full max-h-dvh w-full max-w-md flex-col border-l border-[#edebe9] bg-[#faf9f8] shadow-2xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-sale-drawer-title"
      >
        <div id="pos-sale-drawer-title" className="sr-only">Detalle de la venta</div>
        {panelHeader}
        {panelProgress}
        {panelBody}
        {panelFooter}
      </div>
    </>
  );
}
