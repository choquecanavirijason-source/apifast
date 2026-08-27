import { useEffect, useMemo, useState } from "react";
import { Package, ShoppingCart, Wrench } from "lucide-react";
import ServiceSelectorCard from "./ServiceSelectorCard";
import ProductSelectorCard from "./ProductSelectorCard";
import PosSaleDrawer from "./PosSaleDrawer";
import type { PosSaleStepOneProps } from "../pos.types";

export default function PosSaleStepOne({
  labelClass: _labelClass,
  fieldClass: _fieldClass,
  isLoading,
  products,
  productLines,
  onAddProductToCart,
  onUpdateProductQuantity,
  onRemoveProductLine,
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
  cashReceived,
  setCashReceived,
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
  const [catalogView, setCatalogView] = useState<"servicios" | "productos">("servicios");
  const cartCount = cartLines.length + productLines.length;

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
    const timer = window.setTimeout(() => setAddToCartMessage(""), 2200);
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

  const handleAddProductToCart = (product: (typeof products)[number]) => {
    onAddProductToCart(product);
    showAddedMessage(product.name || "Producto");
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

      {/* Servicios | Productos */}
      <div className="shrink-0 px-4 pt-3 sm:px-5">
        <div className="inline-flex rounded-lg border border-[#c8c6c4] bg-white p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setCatalogView("servicios")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              catalogView === "servicios" ? "bg-[#094732] text-white shadow-sm" : "text-[#605e5c] hover:bg-[#f3f2f1]"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            Servicios
          </button>
          <button
            type="button"
            onClick={() => setCatalogView("productos")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              catalogView === "productos" ? "bg-[#094732] text-white shadow-sm" : "text-[#605e5c] hover:bg-[#f3f2f1]"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Productos
            {productLines.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                {productLines.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Catálogo — ocupa todo el espacio */}
      <div className="min-h-0 w-full flex-1 overflow-hidden">
        {catalogView === "servicios" ? (
          <ServiceSelectorCard
            labelClass="mb-2 block text-sm font-semibold text-[#323130]"
            fieldClass="h-9 w-full rounded-sm border border-[#8a8886] text-sm focus:border-[#094732] focus:ring-0"
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
        ) : (
          <ProductSelectorCard
            labelClass="mb-2 block text-sm font-semibold text-[#323130]"
            fieldClass="h-9 w-full rounded-sm border border-[#8a8886] text-sm focus:border-[#094732] focus:ring-0"
            products={products}
            productLines={productLines}
            onAddProductToCart={handleAddProductToCart}
            onUpdateProductQuantity={onUpdateProductQuantity}
            onRemoveProductLine={onRemoveProductLine}
          />
        )}
      </div>

      {/* Drawer de cobro */}
      <PosSaleDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartLines={cartLines}
        productLines={productLines}
        onUpdateProductQuantity={onUpdateProductQuantity}
        onRemoveProductLine={onRemoveProductLine}
        services={services}
        subtotal={subtotal}
        total={total}
        onRemoveLine={onRemoveLine}
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
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        mixedPayments={mixedPayments}
        setMixedPayments={setMixedPayments}
        notes={notes}
        setNotes={setNotes}
        onOpenRegisterClient={onOpenRegisterClient}
        professionals={professionals}
        primaryActionLabel={
          linkAppointmentId
            ? finalizeSaleLabel          // cobrar reserva → directo
            : cartLines.length === 0 && productLines.length > 0
              ? "Cobrar venta"            // solo productos: no hay nada que agendar
              : "Confirmar venta"         // modo planificador (step2)
        }
        onPrimaryAction={() => {
          setIsCartOpen(false);
          if (linkAppointmentId || (cartLines.length === 0 && productLines.length > 0)) {
            onFinalizeSale();            // reserva, o venta solo-productos: cobra directo
          } else {
            onGoToScheduleStep();        // venta con planificador: ir al paso 2
          }
        }}
        primaryActionDisabled={
          // Sin clienta elegida, el backend asigna el "Cliente Mostrador" de
          // la sucursal — no hace falta bloquear el cobro por eso.
          cartCount === 0 || (mixedPayments.length === 0 && !paymentMethod) || isSubmittingCheckout
        }
        footerHint={
          linkAppointmentId
            ? finalizeFooterHint
            : cartLines.length === 0 && productLines.length > 0
              ? "Venta de productos: se cobra directo, sin turno en agenda."
              : "Usa 'Crear turno ahora' para atención inmediata o 'Agendar reserva' para elegir horario."
        }
        onImmediateCheckout={linkAppointmentId || (cartLines.length === 0 && productLines.length > 0) ? undefined : onCreateImmediateTicket}
        onSecondaryAction={
          linkAppointmentId || (cartLines.length === 0 && productLines.length > 0)
            ? undefined
            : () => { setIsCartOpen(false); onGoToScheduleStep(); }
        }
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
