import { useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import ServiceSelectorCard from "./ServiceSelectorCard";
import PosSaleDrawer from "./PosSaleDrawer";
import type { PosSaleStepOneProps } from "../pos.types";

export default function PosSaleStepOne({
  labelClass: _labelClass,
  fieldClass: _fieldClass,
  isLoading,
  serviceSearch,
  onServiceSearchChange,
  onServiceInputFocus,
  onToggleServiceMenu,
  isServiceMenuOpen,
  serviceMenuPosition,
  filteredServices,
  onServiceSelect,
  selectedServiceCategoryId,
  onCategoryFilterChange,
  serviceCategories,
  onOpenCategoryModal,
  quickServices,
  onAddServiceToCart,
  onRemoveServiceFromCart,
  serviceComboboxRef,
  serviceMenuRef,
  cartLines,
  services,
  subtotal,
  total,
  onRemoveLine,
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
  mixedPayments,
  setMixedPayments,
  notes,
  setNotes,
  onOpenRegisterClient,
  professionals,
  isCartOpen,
  setIsCartOpen,
  onUpdateLine,
  finalizeSaleLabel,
  finalizeFooterHint,
  onFinalizeSale,
  onCreateImmediateTicket,
  isSubmittingCheckout,
  linkAppointmentId,
  ticketPreviews,
  onGoToScheduleStep,
  ticketMode,
  setTicketMode,
  onUpdateTicketTime,
  branchQrImageUrl,
}: PosSaleStepOneProps) {
  const [addToCartMessage, setAddToCartMessage] = useState("");
  const [animateCart, setAnimateCart] = useState(false);
  const cartCount = cartLines.length;

  const cartCountByServiceId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of cartLines) {
      const key = String(line.service_id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [cartLines]);

  useEffect(() => {
    if (!addToCartMessage) return;
    setAnimateCart(true);
    const timer = window.setTimeout(() => {
      setAddToCartMessage("");
      setAnimateCart(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [addToCartMessage]);

  const showAddedMessage = (serviceName: string) => {
    setAddToCartMessage(`"${serviceName.trim() || "Servicio"}" añadido`);
  };

  const handleAddServiceToCart = (service: (typeof quickServices)[number]) => {
    onAddServiceToCart(service);
    showAddedMessage(service.name || "Servicio");
    setIsCartOpen(true);
  };

  const handleServiceSelect = (serviceId: string) => {
    onServiceSelect(serviceId);
    const svc =
      filteredServices.find((s) => String(s.id) === serviceId) ||
      services.find((s) => String(s.id) === serviceId);
    showAddedMessage(svc?.name || "Servicio");
    setIsCartOpen(true);
  };

  const handleAddServiceById = (serviceId: string) => {
    const svc = services.find((s) => String(s.id) === serviceId);
    if (!svc) return;
    onAddServiceToCart(svc);
    showAddedMessage(svc.name || "Servicio");
    setIsCartOpen(true);
  };

  const handleChangeLineService = (localId: string, serviceId: string) => {
    const svc = services.find((s) => String(s.id) === serviceId);
    if (!svc) return;
    // Actualiza la línea existente en su lugar (sin remove+add para evitar duplicados y reordenamiento)
    onUpdateLine(localId, {
      service_id: String(svc.id),
      price: Number(svc.price ?? 0),
      duration_minutes: svc.duration_minutes,
    });
  };

  return (
    <div
      className={`relative flex h-full min-h-0 w-full flex-col bg-[#f3f2f1] text-[#323130] transition-[padding] duration-200 ${
        isLoading ? "pointer-events-none opacity-60" : ""
      } ${isCartOpen ? "pr-112 sm:pr-128" : ""}`}
    >
      {/* Toast de confirmación */}
      {addToCartMessage && (
        <div className="fixed left-1/2 top-4 z-100 flex max-w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-4">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          <span className="truncate">{addToCartMessage}</span>
        </div>
      )}

      {/* Catálogo — ocupa todo el espacio */}
      <div className="min-h-0 w-full flex-1 overflow-hidden">
        <ServiceSelectorCard
          labelClass="mb-2 block text-sm font-semibold text-[#323130]"
          fieldClass="h-9 w-full rounded-sm border border-[#8a8886] text-sm focus:border-[#0078d4] focus:ring-0"
          serviceSearch={serviceSearch}
          onServiceSearchChange={onServiceSearchChange}
          onServiceInputFocus={onServiceInputFocus}
          onToggleServiceMenu={onToggleServiceMenu}
          isServiceMenuOpen={isServiceMenuOpen}
          serviceMenuPosition={serviceMenuPosition}
          filteredServices={filteredServices}
          onServiceSelect={handleServiceSelect}
          selectedServiceCategoryId={selectedServiceCategoryId}
          onCategoryFilterChange={onCategoryFilterChange}
          serviceCategories={serviceCategories}
          onOpenCategoryModal={onOpenCategoryModal}
          quickServices={quickServices}
          onAddServiceToCart={handleAddServiceToCart}
          onRemoveServiceFromCart={onRemoveServiceFromCart}
          serviceComboboxRef={serviceComboboxRef}
          serviceMenuRef={serviceMenuRef}
          cartCountByServiceId={cartCountByServiceId}
        />
      </div>

      {/* FAB carrito */}
      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className={`fixed bottom-6 right-6 z-42 flex h-14 min-w-14 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] ${
          animateCart ? "scale-125 bg-emerald-500" : "scale-100 bg-[#0078d4] hover:bg-[#005a9e]"
        }`}
        aria-label={`Detalle de la venta: ${cartCount} servicios`}
      >
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
          {cartCount}
        </span>
      </button>

      {/* Drawer de cobro */}
      <PosSaleDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartLines={cartLines}
        services={services}
        subtotal={subtotal}
        total={total}
        onRemoveLine={onRemoveLine}
        onAddServiceById={handleAddServiceById}
        onChangeLineService={handleChangeLineService}
        clientComboboxRef={clientComboboxRef}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        setClientId={setClientId}
        isClientMenuOpen={isClientMenuOpen}
        setIsClientMenuOpen={setIsClientMenuOpen}
        filteredClients={filteredClients}
        selectedClient={selectedClient}
        clientPhone={clientPhone}
        clientAddress={clientAddress}
        sellerId={sellerId}
        setSellerId={setSellerId}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        discountType={discountType}
        setDiscountType={setDiscountType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        mixedPayments={mixedPayments}
        setMixedPayments={setMixedPayments}
        notes={notes}
        setNotes={setNotes}
        onOpenRegisterClient={onOpenRegisterClient}
        professionals={professionals}
        primaryActionLabel={
          linkAppointmentId
            ? finalizeSaleLabel          // cobrar reserva → directo
            : "Confirmar venta"          // modo planificador (step2)
        }
        onPrimaryAction={() => {
          setIsCartOpen(false);
          if (linkAppointmentId) {
            onFinalizeSale();            // reserva: cobra directo
          } else {
            onGoToScheduleStep();        // venta con planificador: ir al paso 2
          }
        }}
        primaryActionDisabled={
          cartCount === 0 || !selectedClient || (mixedPayments.length === 0 && !paymentMethod) || isSubmittingCheckout
        }
        footerHint={
          linkAppointmentId
            ? finalizeFooterHint
            : "Usa 'Crear turno ahora' para atención inmediata o 'Agendar reserva' para elegir horario."
        }
        onImmediateCheckout={linkAppointmentId ? undefined : onCreateImmediateTicket}
        onSecondaryAction={linkAppointmentId ? undefined : () => { setIsCartOpen(false); onGoToScheduleStep(); }}
        isSubmitting={isSubmittingCheckout}
        linkAppointmentId={linkAppointmentId}
        ticketPreviews={ticketPreviews}
        onGoToScheduleStep={onGoToScheduleStep}
        ticketMode={ticketMode}
        setTicketMode={setTicketMode}
        onUpdateTicketTime={onUpdateTicketTime}
        onUpdateCartLine={(localId, patch) => onUpdateLine(localId, patch)}
        branchQrImageUrl={branchQrImageUrl}
      />
    </div>
  );
}
