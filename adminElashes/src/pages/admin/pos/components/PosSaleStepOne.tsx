import { useEffect, useState } from "react";
import {
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
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
  onContinueToAgenda,
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
}: PosSaleStepOneProps) {
  const [isSaleDrawerOpen, setIsSaleDrawerOpen] = useState(false);
  const [showToast, setShowToast] = useState(false); // 2. Estado para el aviso
  const [animateCart, setAnimateCart] = useState(false); // 3. Estado para animar el botón
  const [addToCartMessage, setAddToCartMessage] = useState("");
  const cartCount = cartLines.length;

  // Efecto para disparar feedback cuando se agrega algo
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
      {/* 4. TOAST NOTIFICATION */}
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
          onClick={() => setIsSaleDrawerOpen(true)}
          className={`flex h-14 min-w-14 items-center justify-center rounded-full bg-[#0078d4] text-white shadow-lg shadow-slate-900/25 transition-all hover:bg-[#005a9e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] ${
            animateCart ? "scale-125 bg-emerald-500" : "scale-100"
          }`}
          aria-label={`Detalle de la venta: ${cartCount} servicios seleccionados`}
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white ring-2 ring-white">
            {cartCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
                  setIsSaleDrawerOpen(false);
                  onContinueToAgenda();
                }}
          className="flex h-14 min-w-14 items-center justify-center rounded-full bg-[#323130] text-white shadow-lg shadow-slate-900/25 transition-all hover:bg-[#605e5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#323130]"
          aria-label="Ir a agenda/tickets"
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      </div>

      <PosSaleDrawer
        isOpen={isSaleDrawerOpen}
        onClose={() => setIsSaleDrawerOpen(false)}
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
        primaryActionLabel="Asignar tickets a la agenda"
        onPrimaryAction={() => {
          setIsSaleDrawerOpen(false);
          onContinueToAgenda();
        }}
        primaryActionDisabled={cartCount === 0}
        footerHint="Siguiente paso: fecha, hora y operaria por ticket."
      />
    </div>
  );
}