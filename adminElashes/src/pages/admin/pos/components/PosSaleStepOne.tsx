import { useEffect, useState } from "react";
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
  notes,
  setNotes,
  onOpenRegisterClient,
  professionals,
  isCartOpen,
  setIsCartOpen,
  finalizeSaleLabel,
  finalizeFooterHint,
  onFinalizeSale,
  isSubmittingCheckout,
}: PosSaleStepOneProps) {
  const [showToast, setShowToast] = useState(false);
  const [animateCart, setAnimateCart] = useState(false);
  const [addToCartMessage, setAddToCartMessage] = useState("");
  const cartCount = cartLines.length;

  useEffect(() => {
    if (cartCount > 0) {
      setShowToast(true);
      setAnimateCart(true);
      const timer = setTimeout(() => {
        setShowToast(false);
        setAnimateCart(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);

  useEffect(() => {
    if (!addToCartMessage) return;
    const timer = window.setTimeout(() => setAddToCartMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [addToCartMessage]);

  const showAddedMessage = (serviceName: string) => {
    const safeName = serviceName.trim() || "Servicio";
    setAddToCartMessage(`Se agregó "${safeName}" al carrito.`);
  };

  const handleAddServiceToCart = (service: (typeof quickServices)[number]) => {
    onAddServiceToCart(service);
    showAddedMessage(service.name || "Servicio");
  };

  const handleServiceSelect = (serviceId: string) => {
    onServiceSelect(serviceId);
    const selectedService =
      filteredServices.find((service) => String(service.id) === serviceId) ||
      services.find((service) => String(service.id) === serviceId);
    if (selectedService?.name) {
      showAddedMessage(selectedService.name);
    } else {
      showAddedMessage("Servicio");
    }
  };

  const handleAddServiceById = (serviceId: string) => {
    const selectedService = services.find((service) => String(service.id) === serviceId);
    if (!selectedService) return;
    onAddServiceToCart(selectedService);
    showAddedMessage(selectedService.name || "Servicio");
  };

  const handleChangeLineService = (localId: string, serviceId: string) => {
    const selectedService = services.find((service) => String(service.id) === serviceId);
    if (!selectedService) return;
    onRemoveLine(localId);
    onAddServiceToCart(selectedService);
    showAddedMessage(selectedService.name || "Servicio");
  };

  return (
    <div
      className={`relative flex h-[80dvh] max-h-[100dvh] min-h-0 w-full min-w-0 flex-col bg-[#f3f2f1] text-[#323130] ${isLoading ? "pointer-events-none opacity-60" : ""}`}
    >
      {showToast && (
        <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-4">
          <ShoppingCart className="h-4 w-4" />
          ¡Servicio añadido!
        </div>
      )}

      <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 w-full min-w-0 max-w-none">
          <div className="flex h-full min-h-0 w-full flex-col">
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
              serviceComboboxRef={serviceComboboxRef}
              serviceMenuRef={serviceMenuRef}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[42] flex gap-3">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className={`relative flex h-14 min-w-14 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/25 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] ${
            animateCart ? "scale-125 bg-emerald-500" : "scale-100 bg-[#0078d4] hover:bg-[#005a9e]"
          }`}
          aria-label={`Detalle de la venta: ${cartCount} servicios seleccionados`}
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
            {cartCount}
          </span>
        </button>
      </div>

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
        notes={notes}
        setNotes={setNotes}
        onOpenRegisterClient={onOpenRegisterClient}
        professionals={professionals}
        primaryActionLabel={finalizeSaleLabel}
        onPrimaryAction={() => {
          setIsCartOpen(false);
          onFinalizeSale();
        }}
        primaryActionDisabled={cartCount === 0 || !selectedClient || isSubmittingCheckout}
        footerHint={finalizeFooterHint}
        isSubmitting={isSubmittingCheckout}
      />
    </div>
  );
}
