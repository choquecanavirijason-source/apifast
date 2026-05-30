import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertCircle, AlertTriangle, Banknote, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Plus, Search, ShoppingCart, Tag, Ticket, Trash2, UserX, X } from "lucide-react";
import { AgendaService, type ProfessionalForSelect, type ServiceOption } from "../../../../core/services/agenda/agenda.service";
import type { CartLine, PosCheckoutTicketPreview, PosSaleClientOption, SplitPayment } from "../pos.types";
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
  ticketMode?: "individual" | "group";
  setTicketMode?: (mode: "individual" | "group") => void;
  onUpdateTicketTime?: (localId: string, date: string, time: string) => void;
  professionalBusyUntilMap?: Map<string, string>;
  onApplySellerToAllLines?: () => void;
  onImmediateCheckout?: (payLater: boolean) => void;
  /** Pagos divididos (pago mixto). */
  splitPayments: SplitPayment[];
  setSplitPayments: (value: SplitPayment[]) => void;
  /** Venta sin cliente registrado. */
  isAnonymousSale: boolean;
  setIsAnonymousSale: (value: boolean) => void;
  anonymousName: string;
  setAnonymousName: (value: string) => void;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  qr: "QR",
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
  professionalBusyUntilMap = new Map(),
  onApplySellerToAllLines,
  onImmediateCheckout,
  splitPayments,
  setSplitPayments,
  isAnonymousSale,
  setIsAnonymousSale,
  anonymousName,
  setAnonymousName,
}: PosSaleDrawerProps) {
  const isPanel = mode === "panel";

  const cartCount = cartLines.length;
  const hasClient = isAnonymousSale || !!selectedClient;
  const step1Done = cartCount > 0;
  const step2Done = hasClient;
  const step3Done = splitPayments.length > 1
    ? splitPayments.every((sp) => sp.method && Number(sp.amount) > 0)
    : !!paymentMethod;

  const [serviceQuery, setServiceQuery] = useState("");
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [isSellerOpen, setIsSellerOpen] = useState(false);
  const sellerDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showSinHoraConfirm, setShowSinHoraConfirm] = useState(false);

  // Feature 1: Vuelto
  const [cashReceived, setCashReceived] = useState("");
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = cashReceivedNum > 0 ? cashReceivedNum - total : null;

  // Feature 2: pago mixto toggle
  const [isSplitMode, setIsSplitMode] = useState(splitPayments.length > 1);

  // Historial de la clienta
  const [clientHistory, setClientHistory] = useState<Array<{
    id: number; ticket_code: string | null; service_names: string[] | undefined; start_time: string;
  }>>([]);

  useEffect(() => {
    if (!selectedClient || isAnonymousSale) { setClientHistory([]); return; }
    AgendaService.listTickets({
      client_id: Number(selectedClient.id),
      status_filter: "completed",
      limit: 3,
    }).then((items) => {
      setClientHistory(items.map((t) => ({
        id: t.id, ticket_code: t.ticket_code, service_names: t.service_names, start_time: t.start_time,
      })));
    }).catch(() => setClientHistory([]));
  }, [selectedClient?.id, isAnonymousSale]);

  // Limpiar datos del tutor al cambiar cliente
  const [tutorNombre, setTutorNombre] = useState("");
  const [tutorCI, setTutorCI] = useState("");
  const [tutorTelefono, setTutorTelefono] = useState("");
  const clientAge = typeof selectedClient?.age === "number" ? selectedClient.age : null;
  const isMinorClient = !isAnonymousSale && clientAge !== null && clientAge < 18;
  const tutorDataComplete = !isMinorClient || (tutorNombre.trim() !== "" && tutorCI.trim() !== "");

  useEffect(() => {
    setTutorNombre(""); setTutorCI(""); setTutorTelefono("");
  }, [selectedClient?.id]);

  // Split payment sync con prop externa
  useEffect(() => {
    setIsSplitMode(splitPayments.length > 1);
  }, [splitPayments.length]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const clientSectionRef = useRef<HTMLDivElement | null>(null);
  const prevStep1Ref = useRef(step1Done);

  useEffect(() => {
    if (step1Done && !prevStep1Ref.current) {
      clientSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevStep1Ref.current = step1Done;
  }, [step1Done]);

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

  // Reset cash received cuando cambia método o total
  useEffect(() => {
    setCashReceived("");
  }, [paymentMethod, total]);

  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
  const filteredServiceOptions = useMemo(() => {
    if (!normalizedServiceQuery) return services.slice(0, 14);
    return services.filter((s) => s.name.toLowerCase().includes(normalizedServiceQuery)).slice(0, 14);
  }, [normalizedServiceQuery, services]);

  const groupedCartLines = useMemo(() => {
    const groups = new Map<string, CartLine[]>();
    cartLines.forEach((line) => {
      const key = String(line.service_id || line.localId);
      const existing = groups.get(key) ?? [];
      groups.set(key, [...existing, line]);
    });
    return Array.from(groups.values());
  }, [cartLines]);

  if (!isOpen && !isPanel) return null;

  // ── Handlers para pago mixto ─────────────────────────────────────────────

  const enableSplitMode = () => {
    const firstMethod = paymentMethod || "cash";
    const half = (total / 2).toFixed(2);
    const secondMethod = firstMethod === "cash" ? "qr" : "cash";
    setSplitPayments([
      { method: firstMethod, amount: half },
      { method: secondMethod, amount: (total - parseFloat(half)).toFixed(2) },
    ]);
    setIsSplitMode(true);
  };

  const disableSplitMode = () => {
    setSplitPayments([]);
    setIsSplitMode(false);
  };

  const updateSplitPayment = (index: number, field: "method" | "amount", value: string) => {
    const next = splitPayments.map((sp, i) => i === index ? { ...sp, [field]: value } : sp);
    setSplitPayments(next);
    // Si es el primer método, sincronizar con paymentMethod principal
    if (index === 0 && field === "method") setPaymentMethod(value);
  };

  const splitTotal = splitPayments.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const splitDiff = Math.abs(splitTotal - total);
  const splitValid = splitDiff < 0.01;

  // ── Helpers de display ───────────────────────────────────────────────────

  const handlePrintTickets = () => {
    if (!ticketPreviews.length) return;
    const rows = ticketPreviews
      .map((p) => `<tr><td>${p.serviceName}</td><td>${p.date}</td><td>${p.without_time ? "Sin hora" : p.time}</td><td>${p.professionalName}</td><td>${p.status}</td></tr>`)
      .join("");
    const win = window.open("", "_blank", "width=700,height=500");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Tickets</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:16px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px 8px;}th{background:#f3f2f1;}</style></head><body>
      <h2>Tickets en agenda</h2><table><thead><tr><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Operaria</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody></table><br/><button onclick="window.print()">Imprimir</button></body></html>`);
    win.document.close(); win.focus(); win.print();
  };

  const stepBorder = (isDone: boolean, isActive: boolean) =>
    isDone ? "border-l-[3px] border-l-[#107c10]"
      : isActive ? "border-l-[3px] border-l-[#0078d4]"
      : "border-l-[3px] border-l-transparent";

  const labelClass = "mb-1 block text-xs font-semibold text-[#605e5c]";
  const bcField = "w-full h-9 rounded-sm border border-[#8a8886] bg-white px-2.5 text-sm text-[#323130] outline-none transition placeholder:text-[#605e5c] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35 disabled:bg-[#f3f2f1] disabled:text-[#a19f9d]";

  // ════════════════════════════════════════════════════════════════════════
  // PANEL BODY
  // ════════════════════════════════════════════════════════════════════════

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
        <button type="button" onClick={onClose}
          className="shrink-0 rounded-sm p-2 text-[#605e5c] transition hover:bg-[#f3f2f1]" aria-label="Cerrar panel">
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  const panelBody = (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-white">
      {/* Progreso */}
      <div className="flex items-center gap-0 border-b border-[#edebe9] bg-[#f3f2f1]">
        {([
          { label: "Servicios", done: step1Done, active: !step1Done },
          { label: "Cliente", done: step2Done, active: step1Done && !step2Done },
          { label: "Pago", done: step3Done, active: step2Done && !step3Done },
        ] as { label: string; done: boolean; active: boolean }[]).map((step, i) => (
          <div key={step.label} className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-semibold border-r last:border-r-0 border-[#edebe9] ${step.done ? "text-[#107c10]" : step.active ? "text-[#0078d4]" : "text-[#a19f9d]"}`}>
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? "bg-[#107c10] text-white" : step.active ? "bg-[#0078d4] text-white" : "bg-[#edebe9] text-[#605e5c]"}`}>
              {step.done ? "✓" : i + 1}
            </span>
            {step.label}
          </div>
        ))}
      </div>

      {/* ── Carrito ─────────────────────────────────────────────────────── */}
      <div className={`border-b border-[#edebe9] ${stepBorder(step1Done, !step1Done)}`}>
        <div className={`flex items-center gap-2 px-4 py-3 ${!step1Done ? "bg-[#fff4ce]" : "bg-[#faf9f8]"}`}>
          <ShoppingCart className={`h-4 w-4 ${!step1Done ? "text-[#8a6a1f]" : "text-[#0078d4]"}`} />
          <span className="text-sm font-semibold text-[#323130]">Servicios ({cartCount})</span>
          {!step1Done && <span className="ml-auto text-[10px] font-semibold text-[#8a6a1f]">Requerido</span>}
        </div>

        {/* Agregar servicio */}
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
            <button type="button" onClick={() => setIsServiceMenuOpen((c) => !c)}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]">
              <ChevronDown className="h-4 w-4" />
            </button>
            {isServiceMenuOpen && (
              <div className="absolute z-70 mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                <div className="max-h-56 overflow-y-auto py-1">
                  {filteredServiceOptions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#605e5c]">No se encontraron servicios.</p>
                  ) : (
                    filteredServiceOptions.map((service) => (
                      <button key={service.id} type="button"
                        onClick={() => { onAddServiceById(String(service.id)); setServiceQuery(""); setIsServiceMenuOpen(false); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1]">
                        <span className="truncate text-[#323130]">{service.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-[#0078d4]">Bs {Number(service.price ?? 0).toFixed(2)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
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
                {groupedCartLines.map((group, groupIdx) => {
                  const repLine = group[0];
                  const count = group.length;
                  const groupTotal = group.reduce((s, l) => s + l.price, 0);
                  return (
                    <tr key={repLine.localId} className="transition-colors hover:bg-[#f3f2f1]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] text-[#a19f9d]">{groupIdx + 1}.</span>
                          <select value={repLine.service_id}
                            onChange={(e) => { group.forEach((l) => onChangeLineService(l.localId, e.target.value)); }}
                            className="h-9 w-full rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35">
                            <option value="">Servicio...</option>
                            {services.map((s) => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
                          </select>
                          {count > 1 && (
                            <span className="shrink-0 rounded-full bg-[#eef6ff] px-2 py-0.5 text-[11px] font-bold text-[#0078d4]">x{count}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-[#323130]">Bs {groupTotal.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => onRemoveLine(group[group.length - 1].localId)}
                          className="text-[#a19f9d] transition-colors hover:text-[#d13438]"
                          title={count > 1 ? `Quitar 1 de ${count}` : "Quitar servicio"}>
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
          {total !== subtotal && (<> · Con descuento: <span className="font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span></>)}
        </div>
      </div>

      {/* ── Datos de la venta ─────────────────────────────────────────────── */}
      <div className="pb-4">
        <div className="border-b border-[#edebe9] bg-[#faf9f8] px-4 py-3">
          <p className="text-sm font-semibold text-[#323130]">Datos de la venta</p>
          <p className="text-xs text-[#605e5c]">Cliente, cobro y notas</p>
        </div>

        {/* ── Feature 6: toggle venta anónima ─────────────────────────────── */}
        <div className="border-b border-[#edebe9] bg-white px-4 py-2">
          <label className="flex cursor-pointer items-center gap-2.5">
            <div className="relative">
              <input type="checkbox" className="sr-only peer" checked={isAnonymousSale}
                onChange={(e) => {
                  setIsAnonymousSale(e.target.checked);
                  if (!e.target.checked) setAnonymousName("");
                }} />
              <div className="h-5 w-9 rounded-full border border-[#8a8886] bg-[#f3f2f1] transition peer-checked:border-[#d13438] peer-checked:bg-[#d13438] peer-focus:ring-2 peer-focus:ring-[#d13438]/30" />
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </div>
            <UserX className={`h-4 w-4 shrink-0 ${isAnonymousSale ? "text-[#d13438]" : "text-[#a19f9d]"}`} />
            <span className={`text-xs font-semibold ${isAnonymousSale ? "text-[#d13438]" : "text-[#605e5c]"}`}>
              Venta sin cliente registrado
            </span>
          </label>
          {isAnonymousSale && (
            <div className="mt-2">
              <input
                type="text"
                value={anonymousName}
                onChange={(e) => setAnonymousName(e.target.value)}
                placeholder="Nombre de referencia (opcional)"
                className={bcField}
              />
              <p className="mt-1 text-[11px] text-[#605e5c]">
                Se creará un cliente temporal con este nombre.
              </p>
            </div>
          )}
        </div>

        {/* ── Selector de cliente ─────────────────────────────────────────── */}
        <div className="relative" ref={clientSectionRef}>
          <div className={`border-b px-4 py-4 border-[#edebe9] ${stepBorder(step2Done, step1Done && !step2Done)} ${step1Done && !step2Done && !isAnonymousSale ? "bg-[#f0f8ff]" : ""} transition-[filter,opacity] duration-200 ${!step1Done ? "blur-[3px] opacity-40 pointer-events-none select-none" : ""} ${isAnonymousSale ? "opacity-40 pointer-events-none select-none" : ""}`}>
            <div className="mb-1 flex items-center gap-1.5">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step2Done ? "bg-[#107c10] text-white" : "bg-[#d13438] text-white"}`}>
                {step2Done ? "✓" : "2"}
              </span>
              <p className="text-xs font-semibold text-[#323130]">
                Cliente <span className="text-[#d13438]">*</span>
                {isAnonymousSale && <span className="ml-1 text-[#605e5c] font-normal">(omitido — venta anónima)</span>}
              </p>
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
                    } else { setClientId(""); }
                    setIsClientMenuOpen(true);
                  }}
                  onFocus={() => setIsClientMenuOpen(true)}
                  placeholder="Nombre, apellido, teléfono o CI..."
                  className={`${bcField} pl-9 ${!selectedClient && !isAnonymousSale ? "border-[#f5c6cb] focus:border-[#d13438] focus:ring-[#d13438]/20" : "border-[#8a8886]"}`}
                />
                <button type="button" onClick={() => setIsClientMenuOpen((c) => !c)}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-[#605e5c] transition hover:bg-[#f3f2f1]">
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
                            <button key={client.id} type="button"
                              onClick={() => {
                                if (!isSelected) { setClientId(String(client.id)); setClientSearch(fullName); }
                                setIsClientMenuOpen(false);
                              }}
                              className={`flex w-full flex-col px-3 py-2 text-left text-sm transition hover:bg-[#f3f2f1] ${isSelected ? "bg-[#eef6ff]" : ""}`}>
                              <div className="flex w-full items-center justify-between">
                                <span className={`truncate ${isSelected ? "font-semibold text-[#0078d4]" : "text-[#323130]"}`}>{fullName}</span>
                                <div className="ml-3 flex shrink-0 items-center gap-2">
                                  {isSelected && <span className="text-[10px] font-bold text-[#0078d4]">✓</span>}
                                  {isActive && statusLabel && (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${client.status === "en_servicio" ? "bg-[#dff6dd] text-[#107c10]" : "bg-[#fff4ce] text-[#8a6a1f]"}`}>
                                      {statusLabel}
                                    </span>
                                  )}
                                  <span className="text-xs text-[#605e5c]">{client.phone || "Sin tel."}</span>
                                </div>
                              </div>
                              {/* Feature 4: mostrar CI si disponible */}
                              {client.ci && (
                                <span className="mt-0.5 text-[10px] text-[#a19f9d]">CI: {client.ci}</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={onOpenRegisterClient} title="Nuevo cliente"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-[#edebe9] bg-[#faf9f8] text-[#605e5c] transition hover:border-[#0078d4] hover:text-[#0078d4]">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {!selectedClient && step1Done && !isAnonymousSale && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#d13438]">
                ⚠ Selecciona o crea un cliente para continuar
              </p>
            )}
            {/* Historial reciente */}
            {selectedClient && clientHistory.length > 0 && (
              <div className="mt-3 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">Últimas visitas</p>
                <ul className="space-y-1.5">
                  {clientHistory.map((h) => {
                    const date = new Date(h.start_time);
                    const dateLabel = Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
                    return (
                      <li key={h.id} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="truncate text-[#323130]">{h.service_names?.join(", ") ?? "—"}</span>
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
                  <p className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">{clientPhone || "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-[#605e5c]">Dirección</p>
                  <p className="truncate rounded-sm border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs font-medium text-[#323130]">{clientAddress || "—"}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tutor para menor de edad */}
        {isMinorClient && selectedClient && (
          <div className="border-b border-[#edebe9] bg-[#fff4ce] px-4 py-3">
            <p className="mb-1 text-xs font-bold text-[#8a6a1f]">⚠ Clienta menor de edad ({clientAge} años) — autorización del tutor requerida</p>
            <p className="mb-3 text-[11px] text-[#605e5c]">Completa los datos del tutor o responsable legal antes de crear el ticket.</p>
            <div className="space-y-2">
              <div>
                <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Nombre del tutor <span className="text-[#d13438]">*</span></label>
                <input type="text" value={tutorNombre} onChange={(e) => setTutorNombre(e.target.value)} placeholder="Nombre completo" className={bcField} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">CI / DNI <span className="text-[#d13438]">*</span></label>
                  <input type="text" value={tutorCI} onChange={(e) => setTutorCI(e.target.value)} placeholder="Número de CI" className={bcField} />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">Teléfono</label>
                  <input type="tel" value={tutorTelefono} onChange={(e) => setTutorTelefono(e.target.value)} placeholder="Tel. del tutor" className={bcField} />
                </div>
              </div>
              {!tutorDataComplete && (
                <p className="text-[11px] font-semibold text-[#d13438]">⛔ Nombre y CI del tutor son obligatorios para continuar.</p>
              )}
            </div>
          </div>
        )}

        {/* Tickets + Operaria + Pago */}
        <div>
          {linkAppointmentId && (
            <div className="border-b border-[#edebe9] bg-[#eef6ff] px-4 py-3 text-xs text-[#004578]">
              Cobrando reserva #{linkAppointmentId}. No se duplicará la cita en agenda.
            </div>
          )}

          {/* Operaria */}
          {(() => {
            const selectedPro = professionals.find((p) => String(p.id) === sellerId);
            const isBusy = selectedPro?.is_busy === true;
            return (
              <div className={`border-b border-[#edebe9] px-4 py-4 ${stepBorder(step3Done, step2Done && !step3Done)}`}>
                <label className={labelClass}>Operaria</label>
                <p className="mb-2 text-[11px] text-[#605e5c]">Se asignará a los tickets que aún no tengan operaria.</p>
                <div className="relative" ref={sellerDropdownRef}>
                  <button type="button" onClick={() => setIsSellerOpen((o) => !o)}
                    className={`${bcField} flex cursor-pointer items-center justify-between pr-8 text-left ${isBusy ? "border-[#d13438] bg-[#fff4f5]" : ""}`}>
                    {selectedPro ? (
                      <span className={`flex items-center gap-2 ${isBusy ? "text-[#a19f9d] line-through" : "text-[#323130]"}`}>
                        {selectedPro.username}
                        {selectedPro.skill_level ? <span className="text-amber-400 text-xs">{"★".repeat(selectedPro.skill_level)}{"☆".repeat(5 - (selectedPro.skill_level ?? 0))}</span> : null}
                        {isBusy && <span className="text-[11px] font-semibold text-[#d13438] no-underline not-line-through ml-1">(ocupada)</span>}
                      </span>
                    ) : (<span className="text-[#605e5c]">Seleccionar operaria...</span>)}
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                  </button>
                  {isSellerOpen && (
                    <div className="absolute z-70 mt-1 w-full overflow-hidden rounded-sm border border-[#edebe9] bg-white shadow-lg">
                      <div className="max-h-56 overflow-y-auto py-1">
                        <button type="button" onClick={() => { setSellerId(""); setIsSellerOpen(false); }}
                          className="flex w-full items-center px-3 py-2 text-sm text-[#605e5c] transition hover:bg-[#f3f2f1]">
                          Sin operaria asignada
                        </button>
                        {professionals.map((p) => {
                          const busy = p.is_busy === true;
                          const freeAt = professionalBusyUntilMap.get(String(p.id));
                          return (
                            <button key={p.id} type="button" disabled={busy}
                              onClick={() => { if (!busy) { setSellerId(String(p.id)); setIsSellerOpen(false); } }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${busy ? "cursor-not-allowed opacity-60" : String(p.id) === sellerId ? "bg-[#eef6ff]" : "hover:bg-[#f3f2f1]"}`}>
                              <span className={`flex items-center gap-2 ${busy ? "line-through text-[#a19f9d]" : "text-[#323130]"}`}>
                                {p.username}
                                {p.skill_level ? <span className="text-amber-400 text-xs">{"★".repeat(p.skill_level)}{"☆".repeat(5 - p.skill_level)}</span> : null}
                              </span>
                              <div className="flex shrink-0 items-center gap-2 ml-2">
                                {busy ? (
                                  <span className="rounded-full bg-[#fde7e9] px-2 py-0.5 text-[10px] font-bold text-[#d13438]">
                                    {freeAt ? `Libre ~${freeAt}` : "Ocupada"}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-[#dff6dd] px-2 py-0.5 text-[10px] font-bold text-[#107c10]">✓ Libre</span>
                                )}
                                {String(p.id) === sellerId && !busy && <span className="text-[10px] font-bold text-[#0078d4]">●</span>}
                                {p.branch_name && <span className="text-[11px] text-[#a19f9d]">{p.branch_name}</span>}
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
                    Esta operaria está ocupada. Espera a que termine o elige otra.
                  </p>
                )}
                {sellerId && !isBusy && onApplySellerToAllLines && cartCount > 0 && (
                  <button type="button" onClick={onApplySellerToAllLines}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-[#0078d4] bg-[#eef6ff] py-1.5 text-[11px] font-semibold text-[#0078d4] transition hover:bg-[#deeeff]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Asignar a todos los tickets sin operaria →
                  </button>
                )}
              </div>
            );
          })()}

          {/* Descuento + Pago + Notas */}
          <div className={`space-y-4 border-b border-[#edebe9] px-4 py-4 ${stepBorder(step3Done, step2Done && !step3Done)} ${step2Done && !step3Done ? "bg-[#fffdf5]" : ""}`}>
            {/* Descuento */}
            <div>
              <label className={labelClass} htmlFor="pos-drawer-discount">Descuento</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#605e5c]" />
                  <input id="pos-drawer-discount" type="number" min={0}
                    className={`${bcField} pl-9`} value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
                </div>
                <div className="relative w-24">
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                    className={`${bcField} cursor-pointer appearance-none pr-7 text-center`}>
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

            {/* ── Feature 2: Método de pago + pago mixto ───────────────────── */}
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step3Done ? "bg-[#107c10] text-white" : "bg-[#8a6a1f] text-white"}`}>
                  {step3Done ? "✓" : "3"}
                </span>
                <p className="text-xs font-semibold text-[#323130]">Método de pago <span className="text-[#d13438]">*</span></p>
                {!step3Done && step1Done && <span className="ml-auto text-[10px] font-semibold text-[#8a6a1f]">Requerido</span>}
              </div>

              {!isSplitMode ? (
                <>
                  <div className={`grid grid-cols-2 gap-1.5 sm:grid-cols-4 ${!step3Done && step1Done ? "rounded-sm ring-2 ring-[#f0c477] ring-offset-1" : ""}`}>
                    {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" onClick={() => setPaymentMethod(value)}
                        className={`flex flex-col items-center gap-1 rounded-sm border px-1 py-2 text-[11px] font-semibold transition-colors ${paymentMethod === value ? "border-[#0078d4] bg-[#0078d4] text-white shadow-sm" : "border-[#edebe9] bg-[#faf9f8] text-[#605e5c] hover:border-[#c8c6c4] hover:text-[#323130]"}`}>
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Feature 1: Vuelto — solo en efectivo y sin split */}
                  {paymentMethod === "cash" && (
                    <div className="mt-3 rounded-sm border border-[#edebe9] bg-[#f0fdf0] px-3 py-2.5">
                      <label className="mb-1.5 block text-[11px] font-semibold text-[#107c10]">
                        <Banknote className="mr-1 inline h-3.5 w-3.5" />
                        Monto recibido en efectivo
                      </label>
                      <input
                        type="number" min={0} step="0.01"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={`Mín. Bs ${total.toFixed(2)}`}
                        className="w-full rounded-sm border border-[#a5d6a7] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#1b5e20] outline-none focus:border-[#107c10] focus:ring-1 focus:ring-[#107c10]/30"
                      />
                      {change !== null && change >= 0 && (
                        <div className="mt-2 flex items-center justify-between rounded-sm bg-[#107c10] px-3 py-2">
                          <span className="text-xs font-semibold text-white">Vuelto</span>
                          <span className="text-lg font-bold text-white">Bs {change.toFixed(2)}</span>
                        </div>
                      )}
                      {change !== null && change < 0 && (
                        <p className="mt-1.5 text-[11px] font-semibold text-[#d13438]">
                          ⚠ El monto recibido es menor al total (faltan Bs {Math.abs(change).toFixed(2)})
                        </p>
                      )}
                    </div>
                  )}
                  {/* Toggle dividir pago */}
                  <button type="button" onClick={enableSplitMode}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-[#c8c6c4] py-1.5 text-[11px] font-semibold text-[#605e5c] transition hover:border-[#0078d4] hover:text-[#0078d4]">
                    Dividir pago entre dos métodos
                  </button>
                </>
              ) : (
                /* Feature 2: UI de pago mixto */
                <div className="space-y-2">
                  <div className="rounded-sm border border-[#0078d4]/30 bg-[#eef6ff] px-3 py-2 text-[11px] text-[#004578]">
                    Pago mixto: ingresa el monto de cada método. La suma debe ser Bs {total.toFixed(2)}.
                  </div>
                  {splitPayments.map((sp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={sp.method}
                        onChange={(e) => updateSplitPayment(idx, "method", e.target.value)}
                        className="h-9 w-32 shrink-0 rounded-sm border border-[#8a8886] bg-white px-2 text-sm text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35">
                        {PAYMENT_METHODS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#605e5c]">Bs</span>
                        <input type="number" min={0} step="0.01"
                          value={sp.amount}
                          onChange={(e) => updateSplitPayment(idx, "amount", e.target.value)}
                          className={`${bcField} pl-8`} placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                  {/* Resumen del split */}
                  <div className={`flex items-center justify-between rounded-sm border px-3 py-2 text-xs font-semibold ${splitValid ? "border-[#107c10] bg-[#f0fdf0] text-[#107c10]" : "border-[#ffd7d7] bg-[#fff4f5] text-[#d13438]"}`}>
                    <span>Total ingresado</span>
                    <span>Bs {splitTotal.toFixed(2)} {splitValid ? "✓" : `(diff: ${splitDiff.toFixed(2)})`}</span>
                  </div>
                  <button type="button" onClick={disableSplitMode}
                    className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-dashed border-[#c8c6c4] py-1.5 text-[11px] font-semibold text-[#605e5c] transition hover:border-[#d13438] hover:text-[#d13438]">
                    Cancelar pago dividido
                  </button>
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className={labelClass} htmlFor="pos-drawer-notes">Notas</label>
              <textarea id="pos-drawer-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} className={`${bcField} resize-none py-2`} placeholder="Observaciones opcionales..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // PANEL FOOTER
  // ════════════════════════════════════════════════════════════════════════

  const panelFooter = (
    <div className="shrink-0 border-t border-[#edebe9] bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      {/* Total */}
      <div className="mb-2 flex items-center justify-between rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
        <span className="text-xs font-semibold text-[#605e5c]">Total a cobrar</span>
        <span className="text-lg font-bold text-[#0078d4]">Bs {total.toFixed(2)}</span>
      </div>

      {/* Vaciar carrito */}
      <button type="button" onClick={() => cartLines.forEach((l) => onRemoveLine(l.localId))}
        disabled={cartCount === 0 || isSubmitting}
        className={`mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-sm border text-sm font-semibold transition-all ${cartCount === 0 ? "cursor-not-allowed border-[#edebe9] bg-[#f3f2f1] text-[#a19f9d]" : "border-[#f1bfc6] bg-[#fff4f5] text-[#a4262c] hover:bg-[#fde7e9]"}`}>
        <Trash2 className="h-4 w-4" />
        Vaciar carrito
      </button>

      {/* ── Modo WALK-IN ─────────────────────────────────────────────────── */}
      {onImmediateCheckout && !linkAppointmentId ? (
        <>
          {(cartCount === 0 || !hasClient || !step3Done || !tutorDataComplete) && (
            <p className="mb-2 rounded-sm bg-[#fff4ce] px-3 py-1.5 text-center text-[11px] font-medium text-[#8a6a1f]">
              {cartCount === 0
                ? "Agrega al menos un servicio"
                : !hasClient
                  ? "Selecciona o registra una clienta"
                  : !tutorDataComplete
                    ? "Completa los datos del tutor (cliente menor)"
                    : isSplitMode && !splitValid
                      ? "Los montos del pago mixto no coinciden con el total"
                      : "Selecciona método de pago"}
            </p>
          )}
          <button type="button"
            disabled={cartCount === 0 || !hasClient || !step3Done || !tutorDataComplete || isSubmitting}
            onClick={() => onImmediateCheckout(false)}
            className={`flex h-11 w-full items-center justify-center rounded-sm text-sm font-semibold transition-all ${cartCount === 0 || !hasClient || !step3Done || !tutorDataComplete || isSubmitting ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]" : "bg-[#107c10] text-white hover:bg-[#0b5e0b]"}`}>
            {isSubmitting ? "Procesando…" : "Crear turno"}
          </button>
        </>
      ) : (
        /* ── Modo RESERVA ─────────────────────────────────────────────────── */
        <>
          {secondaryActionLabel && onSecondaryAction && (
            <button type="button" onClick={onSecondaryAction} disabled={isSubmitting}
              className="mb-2 flex h-9 w-full items-center justify-center rounded-sm border border-[#8a8886] bg-white text-sm font-semibold text-[#323130] transition hover:bg-[#f3f2f1] disabled:cursor-not-allowed disabled:opacity-50">
              {secondaryActionLabel}
            </button>
          )}

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
                <button type="button" onClick={() => { setShowSinHoraConfirm(false); onPrimaryAction(); }}
                  className="flex-1 rounded-sm bg-[#8a6a1f] py-1.5 text-xs font-semibold text-white hover:bg-[#6d5218]">Confirmar igual</button>
                <button type="button" onClick={() => setShowSinHoraConfirm(false)}
                  className="flex-1 rounded-sm border border-[#edebe9] bg-white py-1.5 text-xs font-semibold text-[#323130] hover:bg-[#f3f2f1]">Cancelar</button>
              </div>
            </div>
          )}

          {!showSinHoraConfirm && (() => {
            const sellerPro = professionals.find((p) => String(p.id) === sellerId);
            const sellerBusy = sellerPro?.is_busy === true;
            const isDisabled = primaryActionDisabled || sellerBusy || !tutorDataComplete || (isSplitMode && !splitValid);
            const sinHoraCount = ticketPreviews.filter((p) => p.scheduleLabel?.includes("Sin hora")).length;
            const handleClick = () => {
              if (!isDisabled && sinHoraCount > 0) { setShowSinHoraConfirm(true); } else { onPrimaryAction(); }
            };
            return (
              <>
                {isDisabled && !isSubmitting && (
                  <p className={`mb-1.5 rounded-sm px-3 py-1.5 text-center text-[11px] font-medium ${sellerBusy ? "bg-[#fde7e9] text-[#d13438]" : "bg-[#fff4ce] text-[#8a6a1f]"}`}>
                    {sellerBusy
                      ? "⛔ La operaria seleccionada está ocupada. Espera o elige otra."
                      : isSplitMode && !splitValid
                        ? "⚠ Los montos del pago mixto no coinciden con el total"
                        : cartCount === 0
                          ? "⚠ Paso 1: Agrega al menos un servicio"
                          : !hasClient
                            ? "⚠ Paso 2: Selecciona o crea un cliente"
                            : !step3Done
                              ? "⚠ Paso 3: Selecciona un método de pago"
                              : "⚠ Completa los datos para continuar"}
                  </p>
                )}
                {!isDisabled && sinHoraCount > 0 && !isSubmitting && (
                  <p className="mb-1.5 flex items-center gap-1 rounded-sm bg-[#fff4ce] px-3 py-1.5 text-[11px] font-medium text-[#8a6a1f]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {sinHoraCount} ticket(s) sin hora — se pedirá confirmación
                  </p>
                )}
                <button type="button" onClick={handleClick}
                  disabled={isDisabled || isSubmitting}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-all ${isDisabled || isSubmitting ? "cursor-not-allowed bg-[#f3f2f1] text-[#a19f9d]" : "bg-[#0078d4] text-white shadow-sm hover:bg-[#005a9e] active:bg-[#004578]"}`}>
                  {isSubmitting ? "Procesando…" : primaryActionLabel}
                </button>
              </>
            );
          })()}
          <p className="mt-2 text-center text-[11px] text-[#605e5c]">{footerHint}</p>
        </>
      )}
    </div>
  );

  if (isPanel) {
    return (
      <div className="flex h-full flex-col overflow-hidden border-l border-[#edebe9] bg-[#faf9f8]">
        {panelHeader}
        {panelBody}
        {panelFooter}
      </div>
    );
  }

  return (
    <>
      <button type="button"
        className="fixed inset-0 z-43 bg-[#323130]/40 backdrop-blur-[1px]"
        aria-label="Cerrar panel de venta"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-45 flex h-full max-h-dvh w-full max-w-md flex-col border-l border-[#edebe9] bg-[#faf9f8] shadow-2xl sm:max-w-lg"
        role="dialog" aria-modal="true" aria-labelledby="pos-sale-drawer-title"
      >
        <div id="pos-sale-drawer-title" className="sr-only">Detalle de la venta</div>
        {panelHeader}
        {panelBody}
        {panelFooter}
      </div>
    </>
  );
}
