import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "react-toastify";
import { Building2, CalendarDays, DoorOpen, HelpCircle, Lock, Package, ShoppingCart, Wrench } from "lucide-react";
import { setSelectedBranchId } from "../../../core/utils/branch";
import Layout from "../../../components/common/layout";
import GenericModal from "../../../components/common/modal/GenericModal";
import { Button, SegmentedTabs } from "../../../components/common/ui";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import type { Product } from "../../../core/types/IProduct";
import { ProductService, type ProductCategoryOption, type ProductCreatePayload } from "../../../core/services/product/product.service";
import ProductFormModal from "../products/ProductFormModal";
import RegisterClientModal from "../clients/RegisterClientModal";
import CategorySelectionModal from "./components/CategorySelectionModal";
import SalesHistoryTable from "./components/SalesHistoryTable";
import ProductSalesHistoryTable from "./components/ProductSalesHistoryTable";
import PosSaleStepOne from "./components/PosSaleStepOne";
import PosSaleStepTwo from "./components/PosSaleStepTwo";
import PosReceiptModals from "./components/PosReceiptModals";
import TodayTicketsSummary from "./components/TodayTicketsSummary";
import PosTutorialModal, { getPosTutorialStorageKey } from "./components/PosTutorialModal";
import { ROWS_PER_PAGE_OPTIONS } from "./pos.constants";
import { usePosPage } from "./usePosPage";
import useAuth from "../../../core/hooks/useAuth";

type ProductForm = Omit<Product, "id" | "updatedAt">;
type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

const emptyProductForm: ProductForm = {
  name: "",
  sku: "",
  category: "",
  supplier: "",
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  description: "",
  active: true,
};

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "block text-[11px] font-semibold text-slate-400 mb-1.5";
// Modales de Caja (Abrir/Cerrar): texto en negro, sin colores decorativos —
// solo negrita para resaltar lo importante.
const cashLabelClass = "block text-[11px] font-semibold text-[var(--ui-text)] mb-1.5";
// Borde bien visible siempre (no solo al hacer foco) — con border-slate-200
// el recuadro donde escribir casi no se notaba.
const cashFieldClass = "w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/15";

export type PosPageProps = {
  embedded?: boolean;
  initialDate?: string;
  section?: "sale" | "history" | "tickets";
  onCartCountChange?: (count: number) => void;
  onPendingPaymentCountChange?: (count: number) => void;
  cartDrawerSignal?: number;
  onRequestSwitchToPos?: () => void;
  /** No mostrar el tour automático de bienvenida — para embebidos secundarios
   * (ej. "venta rápida" dentro del Calendario) donde no tiene sentido un
   * onboarding de "primer contacto". El hub de Caja POS (Caja y seguimiento)
   * también monta el POS embebido pero SÍ es la pantalla principal de venta,
   * así que ahí el tour debe mostrarse igual. */
  hideTutorial?: boolean;
};

export default function PosPage({ embedded = false, initialDate, section, onCartCountChange, onPendingPaymentCountChange, cartDrawerSignal, hideTutorial = false }: PosPageProps) {
  const pos = usePosPage({ embedded, initialDate, section, onCartCountChange, onPendingPaymentCountChange, cartDrawerSignal });
  const [historyView, setHistoryView] = useState<"servicios" | "productos">("servicios");
  const [showTutorial, setShowTutorial] = useState(false);
  const [tourDrawerStep, setTourDrawerStep] = useState<"servicios" | "cliente" | "pago" | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [productCategories, setProductCategories] = useState<ProductCategoryOption[]>([]);
  const { user, hasPermissionByName, hasRole } = useAuth();
  const canOpenCashSession = hasPermissionByName("payments:manage");
  const canManageInventory = hasPermissionByName("inventory:manage") || hasRole("Cajera");
  const tutorialStorageKey = useMemo(() => getPosTutorialStorageKey(user?.id), [user?.id]);
  const productFormErrors = useMemo<ProductFormErrors>(() => {
    const errors: ProductFormErrors = {};
    const name = productForm.name.trim();
    const sku = productForm.sku.trim().toUpperCase();
    const imageUrl = productForm.imageUrl?.trim() ?? "";

    if (!name) errors.name = "El nombre es obligatorio.";
    else if (name.length < 2) errors.name = "El nombre debe tener al menos 2 caracteres.";

    if (!sku) errors.sku = "El SKU es obligatorio.";
    else if (!/^[A-Z0-9_-]{3,30}$/.test(sku)) errors.sku = "Usa 3-30 caracteres: letras, numeros, guion o guion bajo.";

    if (productForm.price < 0) errors.price = "El precio no puede ser negativo.";
    if (productForm.cost < 0) errors.cost = "El costo no puede ser negativo.";
    if (productForm.stock < 0 || !Number.isInteger(productForm.stock)) errors.stock = "El stock debe ser un entero mayor o igual a 0.";
    if (productForm.minStock < 0 || !Number.isInteger(productForm.minStock)) errors.minStock = "El stock minimo debe ser un entero mayor o igual a 0.";

    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) errors.imageUrl = "La URL debe iniciar con http:// o https://";
      } catch {
        errors.imageUrl = "Ingresa una URL valida.";
      }
    }

    if (productForm.description.length > 500) errors.description = "La descripcion no puede superar los 500 caracteres.";
    return errors;
  }, [productForm]);

  const openProductModal = () => {
    setProductForm({ ...emptyProductForm, category: productCategories[0]?.name ?? "" });
    setIsProductModalOpen(true);
    void ProductService.listCategories()
      .then(setProductCategories)
      .catch(() => toast.error("No se pudieron cargar las categorias de productos."));
  };

  const closeProductModal = () => {
    if (isCreatingProduct) return;
    setIsProductModalOpen(false);
    setProductForm(emptyProductForm);
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (Object.keys(productFormErrors).length > 0) {
      toast.warning(Object.values(productFormErrors)[0]);
      return;
    }
    if (!pos.activeBranchId) {
      toast.warning("Selecciona una sucursal antes de crear el producto.");
      return;
    }

    const category = productCategories.find((item) =>
      item.name.toLowerCase() === productForm.category.trim().toLowerCase(),
    );
    if (productForm.category.trim() && !category) {
      toast.warning("Selecciona una categoria valida.");
      return;
    }

    const payload: ProductCreatePayload = {
      sku: productForm.sku.trim().toUpperCase(),
      name: productForm.name.trim(),
      category_id: category?.id,
      price: Math.max(0, productForm.price),
      cost: Math.max(0, productForm.cost),
      status: productForm.active,
      image_url: productForm.imageUrl?.trim() || undefined,
      initial_stock: Math.max(0, productForm.stock),
      min_stock: productForm.minStock > 0 ? productForm.minStock : undefined,
      branch_id: pos.activeBranchId,
    };

    setIsCreatingProduct(true);
    try {
      await ProductService.createProduct(payload);
      toast.success("Producto creado correctamente.");
      setIsProductModalOpen(false);
      setProductForm(emptyProductForm);
      await pos.loadContext();
    } catch (error) {
      let message: string | undefined;
      if (typeof error === "object" && error !== null && "response" in error) {
        const responseError = error as { response?: { data?: { detail?: string; message?: string } } };
        message = responseError.response?.data?.detail ?? responseError.response?.data?.message;
      }
      toast.error(message ?? "No se pudo crear el producto.");
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Primera vez que este usuario entra al POS (en cualquier navegador/PC):
  // mostrar la guía rápida — no aplica a embebidos secundarios (ver
  // hideTutorial arriba). La key es por usuario, no por navegador, porque
  // varias operarias suelen compartir la misma laptop.
  useEffect(() => {
    if (hideTutorial || !user?.id) return;
    try {
      if (!localStorage.getItem(tutorialStorageKey)) setShowTutorial(true);
    } catch {
      // localStorage puede fallar en modo privado — simplemente no se muestra.
    }
  }, [hideTutorial, tutorialStorageKey, user?.id]);

  return (
    <Layout
      title={
        embedded ? undefined : (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-tight text-[var(--ui-text)]">Caja registradora</span>
              <span className="block text-[11px] leading-tight text-[var(--ui-text-muted)]">Punto de venta · Dynamics-style</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--ui-border)] bg-white px-3 py-1.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <CalendarDays className="h-4 w-4 text-[#094732]" />
              <span className="font-medium text-[var(--ui-text)]">
                {new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </span>
          </span>
        )
      }
      subtitle={undefined}
      pageClassName={
        embedded
          ? "!min-h-0 flex h-full flex-1 flex-col !bg-transparent !p-0 overflow-hidden"
          : "flex h-full min-h-0 flex-col overflow-hidden"
      }
      containerClassName={
        embedded
          ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent !p-0 max-w-none"
          : "flex min-h-0 flex-1 flex-col overflow-hidden"
      }
      contentClassName="flex-1 min-h-0 overflow-hidden"
      toolbar={
        <div className="flex w-full items-center justify-between gap-3">
          <div data-tour="pos-tabs">
            <SegmentedTabs
              options={[
                { id: "sale", label: "Nueva venta" },
                { id: "history", label: "Historial" },
                {
                  id: "lastticket",
                  label: (
                    <span className="flex items-center gap-1.5">
                      Último ticket
                      {pos.receiptSale && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#107c10] px-1 text-[10px] font-bold text-white">✓</span>
                      )}
                    </span>
                  ),
                },
              ]}
              value={pos.activeTab}
              onChange={(tab) => {
                pos.setActiveTab(tab);
                pos.setStep(1);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              title="Ver guía rápida del POS"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
            {pos.cashSession && canOpenCashSession && (
              <button
                type="button"
                onClick={() => void pos.openCloseCashSessionModal()}
                title="Cerrar caja (arqueo)"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-xs font-medium text-[var(--ui-text-muted)] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Cerrar caja
              </button>
            )}
            {pos.activeTab === "sale" && pos.step === 1 && (
              <button
                type="button"
                data-tour="pos-cart-btn"
                onClick={() => pos.setIsCartOpen((prev) => !prev)}
                title={pos.isCartOpen ? "Cerrar carrito" : "Ver carrito de venta"}
                className={`relative flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  pos.isCartOpen
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-[var(--ui-border-strong)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]"
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {pos.isCartOpen ? "Cerrar carrito" : "Ver carrito"}
                {pos.cartLines.length + pos.productLines.length > 0 && (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${pos.isCartOpen ? "bg-[#094732] text-white" : "bg-[#323130] text-white"}`}>
                    {pos.cartLines.length + pos.productLines.length}
                  </span>
                )}
              </button>
            )}
            {pos.editingSale && (
              <>
                <span className="flex h-8 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-800">
                  Editando venta: {pos.editingSale.sale_code}
                </span>
                <button type="button" onClick={pos.resetSaleForm} className="flex h-8 items-center rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-xs font-medium text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]">
                  Salir edicion
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer">

        {/* ── No branch selected ───────────────────────────────────────── */}
        {pos.activeTab === "sale" && !pos.activeBranchId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ui-surface-muted)]">
              <Building2 className="h-8 w-8 text-[var(--ui-text-muted)]" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-base font-semibold text-[var(--ui-text)]">Selecciona una sucursal</p>
              <p className="mt-1.5 text-sm text-[var(--ui-text-muted)]">Para registrar una venta debes elegir una sucursal específica.</p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              {pos.branches.length === 0 ? (
                <p className="text-center text-xs text-[var(--ui-text-muted)]">Cargando sucursales…</p>
              ) : pos.branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => { setSelectedBranchId(branch.id); pos.setActiveBranchId(branch.id); }}
                  className="flex w-full items-center gap-3 rounded-lg border border-[var(--ui-border)] bg-white px-4 py-3 text-left transition hover:border-[#094732] hover:bg-[#ecfdf5]"
                >
                  <Building2 className="h-5 w-5 shrink-0 text-[#094732]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--ui-text)]">{branch.name}</p>
                    {branch.address && <p className="text-xs text-[var(--ui-text-muted)]">{branch.address}</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--ui-text-muted)]">También puedes cambiarla desde el selector en la barra superior</p>
          </div>

        /* ── Sucursal elegida pero sin caja abierta (o todavía verificando) ── */
        ) : pos.activeTab === "sale" && pos.activeBranchId && !pos.cashSession ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            {pos.isLoadingCashSession ? (
              <p className="text-sm text-[var(--ui-text-muted)]">Comprobando el estado de la caja…</p>
            ) : (
              <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ui-surface-muted)]">
              <DoorOpen className="h-8 w-8 text-[var(--ui-text-muted)]" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-base font-semibold text-[var(--ui-text)]">La caja de esta sucursal está cerrada</p>
              <p className="mt-1.5 text-sm text-[var(--ui-text-muted)]">
                {canOpenCashSession
                  ? "Abrila para empezar a registrar ventas — sin abrirla no se puede cobrar."
                  : "Pedile a una encargada o cajera que abra la caja antes de vender."}
              </p>
            </div>
            {canOpenCashSession ? (
              <button
                type="button"
                onClick={() => void pos.openCashSessionModal()}
                className="flex items-center gap-2 rounded-lg bg-[#094732] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#063324]"
              >
                <DoorOpen className="h-4 w-4" />
                Abrir caja
              </button>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-white px-3 py-1.5 text-xs text-[var(--ui-text-muted)]">
                <Lock className="h-3.5 w-3.5" />
                No tenés permiso para abrir caja
              </span>
            )}
              </>
            )}
          </div>

        /* ── Sale step 1 ─────────────────────────────────────────────── */
        ) : pos.activeTab === "sale" && pos.step === 1 ? (
          <PosSaleStepOne
            labelClass={labelClass}
            fieldClass={fieldClass}
            isLoading={pos.isLoading}
            products={pos.products}
            canManageInventory={canManageInventory}
            onCreateProduct={openProductModal}
            productLines={pos.productLines}
            onAddProductToCart={pos.addProductToCart}
            onUpdateProductQuantity={pos.updateProductQuantity}
            onRemoveProductLine={pos.removeProductLine}
            serviceSearch={pos.serviceSearch}
            onServiceSearchChange={(value) => { pos.setServiceSearch(value); pos.updateServiceMenuPosition(); pos.setIsServiceMenuOpen(true); }}
            onServiceInputFocus={() => { pos.updateServiceMenuPosition(); pos.setIsServiceMenuOpen(true); }}
            onToggleServiceMenu={() => { pos.updateServiceMenuPosition(); pos.setIsServiceMenuOpen((c) => !c); }}
            isServiceMenuOpen={pos.isServiceMenuOpen}
            serviceMenuPosition={pos.serviceMenuPosition}
            filteredServices={pos.filteredServices}
            onServiceSelect={pos.handleServiceSelect}
            selectedServiceCategoryId={pos.selectedServiceCategoryId}
            onCategoryFilterChange={pos.setSelectedServiceCategoryId}
            serviceCategories={pos.serviceCategories}
            onOpenCategoryModal={() => pos.setIsCategoryModalOpen(true)}
            quickServices={pos.quickServices}
            onAddServiceToCart={pos.addServiceToCart}
            onRemoveServiceFromCart={(service) => pos.removeLastCartLineForService(String(service.id))}
            serviceComboboxRef={pos.serviceComboboxRef}
            serviceMenuRef={pos.serviceMenuRef}
            cartLines={pos.cartLines}
            services={pos.services}
            subtotal={pos.subtotal}
            total={pos.total}
            onRemoveLine={pos.removeLine}
            onUpdateLine={(localId, patch) => pos.updateLine(localId, patch)}
            clientComboboxRef={pos.clientComboboxRef}
            clientSearch={pos.clientSearch}
            setClientSearch={pos.setClientSearch}
            setClientId={pos.setClientId}
            isClientMenuOpen={pos.isClientMenuOpen}
            setIsClientMenuOpen={pos.setIsClientMenuOpen}
            filteredClients={pos.filteredClients}
            selectedClient={pos.selectedClient}
            clientPhone={pos.clientPhone}
            clientAddress={pos.clientAddress}
            sellerId={pos.sellerId}
            setSellerId={pos.setSellerId}
            discountValue={pos.discountValue}
            setDiscountValue={pos.setDiscountValue}
            discountType={pos.discountType}
            setDiscountType={pos.setDiscountType}
            paymentMethod={pos.paymentMethod}
            setPaymentMethod={pos.setPaymentMethod}
            cashReceived={pos.cashReceived}
            setCashReceived={pos.setCashReceived}
            mixedPayments={pos.mixedPayments}
            setMixedPayments={pos.setMixedPayments}
            notes={pos.notes}
            setNotes={pos.setNotes}
            onOpenRegisterClient={() => pos.setIsRegisterClientOpen(true)}
            professionals={pos.professionals}
            isCartOpen={pos.isCartOpen}
            setIsCartOpen={pos.setIsCartOpen}
            finalizeSaleLabel={pos.linkAppointmentId ? "Cobrar reserva" : "Finalizar venta"}
            finalizeFooterHint={
              pos.linkAppointmentId
                ? "Se cobra y se cierra la reserva con su horario de agenda."
                : pos.ticketMode === "group"
                  ? "Se creará 1 ticket grupal con todos los servicios."
                  : "Se creará un ticket en agenda por cada servicio al finalizar."
            }
            linkAppointmentId={pos.linkAppointmentId}
            ticketPreviews={pos.checkoutTicketPreviews}
            onGoToScheduleStep={() => pos.setStep(2)}
            onFinalizeSale={() => void pos.handleCheckout()}
            onCreateImmediateTicket={(payLater, startService) => void pos.handleImmediateCheckout(payLater, startService)}
            isSubmittingCheckout={pos.isSubmitting}
            ticketMode={pos.ticketMode}
            setTicketMode={pos.setTicketMode}
            onUpdateTicketTime={pos.handleUpdateTicketTime}
            onUpdateCartLine={(localId, patch) => pos.updateLine(localId, patch)}
            branchQrImageUrl={pos.branches.find((b) => b.id === pos.activeBranchId)?.qr_image_url ?? null}
            drawerForceStep={tourDrawerStep}
          />

        /* ── Sale step 2 ─────────────────────────────────────────────── */
        ) : pos.activeTab === "sale" && pos.step === 2 ? (
          <PosSaleStepTwo
            branchOpeningHours={pos.branches.find((b) => b.id === pos.activeBranchId)?.opening_hours ?? null}
            cartLines={pos.cartLines}
            existingTickets={pos.existingTickets}
            services={pos.services}
            clientDisplayName={
              pos.selectedClient
                ? `${pos.selectedClient.nombre} ${pos.selectedClient.apellido}`.trim()
                : (pos.clientSearch.trim() || "Sin cliente")
            }
            editingSaleCode={pos.editingSale?.sale_code ?? null}
            subtotal={pos.subtotal}
            total={pos.total}
            onRemoveLine={pos.removeLine}
            professionals={pos.professionals}
            lineAvailability={pos.lineAvailability}
            saleBaseDate={pos.saleBaseDate}
            updateLine={pos.updateLine}
            setAvailabilityPreviewLineId={pos.setAvailabilityPreviewLineId}
            setAvailabilityPreviewDate={pos.setAvailabilityPreviewDate}
            setAvailabilitySearch={pos.setAvailabilitySearch}
            isSubmitting={pos.isSubmitting}
            onCheckout={() => void pos.handleCheckout()}
            onBack={() => pos.setStep(1)}
            onOpenSalesHistory={() => { pos.setActiveTab("history"); pos.setStep(1); }}
            clientComboboxRef={pos.clientComboboxRef}
            clientSearch={pos.clientSearch}
            setClientSearch={pos.setClientSearch}
            setClientId={pos.setClientId}
            isClientMenuOpen={pos.isClientMenuOpen}
            setIsClientMenuOpen={pos.setIsClientMenuOpen}
            filteredClients={pos.filteredClients}
            selectedClient={pos.selectedClient}
            clientPhone={pos.clientPhone}
            clientAddress={pos.clientAddress}
            sellerId={pos.sellerId}
            setSellerId={pos.setSellerId}
            discountValue={pos.discountValue}
            setDiscountValue={pos.setDiscountValue}
            discountType={pos.discountType}
            setDiscountType={pos.setDiscountType}
            paymentMethod={pos.paymentMethod}
            setPaymentMethod={pos.setPaymentMethod}
            cashReceived={pos.cashReceived}
            setCashReceived={pos.setCashReceived}
            notes={pos.notes}
            setNotes={pos.setNotes}
            onOpenRegisterClient={() => pos.setIsRegisterClientOpen(true)}
            onAddServiceToCart={pos.addServiceToCart}
          />

        /* ── History tab ─────────────────────────────────────────────── */
        ) : pos.activeTab === "history" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <SegmentedTabs
              options={[
                { id: "servicios", label: "Servicios", icon: <Wrench className="h-3.5 w-3.5" /> },
                { id: "productos", label: "Productos", icon: <Package className="h-3.5 w-3.5" /> },
              ]}
              value={historyView}
              onChange={setHistoryView}
            />

            {historyView === "servicios" ? (
              <SalesHistoryTable
                historySearch={pos.historySearch}
                onHistorySearchChange={pos.setHistorySearch}
                historyClientFilter={pos.historyClientFilter}
                onHistoryClientFilterChange={pos.setHistoryClientFilter}
                historyClientOptions={pos.historyClientOptions}
                historyPaymentFilter={pos.historyPaymentFilter}
                onHistoryPaymentFilterChange={pos.setHistoryPaymentFilter}
                historyPaymentOptions={pos.historyPaymentOptions}
                historyDateFrom={pos.historyDateFrom}
                onHistoryDateFromChange={pos.setHistoryDateFrom}
                historyDateTo={pos.historyDateTo}
                onHistoryDateToChange={pos.setHistoryDateTo}
                filteredSalesTotalAmount={pos.filteredSalesTotalAmount}
                allSalesTotalAmount={pos.allSalesTotalAmount}
                rowsPerPage={pos.rowsPerPage}
                rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                onRowsPerPageChange={pos.setRowsPerPage}
                colFilters={pos.colFilters}
                onColFilterChange={(key, value) => pos.setColFilters((prev) => ({ ...prev, [key]: value }))}
                pagedSales={pos.pagedSales}
                currentPage={pos.currentPage}
                totalPages={pos.totalPages}
                filteredSalesCount={pos.filteredServiceSales.length}
                onPageChange={pos.setCurrentPage}
                onViewDetail={pos.setReceiptSale}
                onEditSale={(sale) => void pos.handleEditSaleFromHistory(sale)}
                onCancelSale={(sale) => void pos.handleCancelSaleFromHistory(sale)}
                onDeleteSale={(sale) => void pos.handleDeleteSaleFromHistory(sale)}
                allFilteredSales={pos.filteredServiceSales}
                onRefresh={() => void pos.loadContext()}
                isRefreshing={pos.isLoading}
              />
            ) : (
              <ProductSalesHistoryTable
                sales={pos.filteredSales}
                onViewDetail={pos.setReceiptSale}
                onCancelSale={(sale) => void pos.handleCancelSaleFromHistory(sale)}
                onDeleteSale={(sale) => void pos.handleDeleteSaleFromHistory(sale)}
                onRefresh={() => void pos.loadContext()}
                isRefreshing={pos.isLoading}
              />
            )}
          </div>

        /* ── Last ticket tab ─────────────────────────────────────────── */
        ) : (
          <TodayTicketsSummary
            receiptSale={pos.receiptSale}
            sales={pos.sales}
            existingTickets={pos.existingTickets}
            onNavigateToNewSale={() => pos.setActiveTab("sale")}
          />
        )}

        <PosReceiptModals
          receiptSale={pos.receiptSale}
          onCloseReceipt={() => pos.setReceiptSale(null)}
          receiptTicketEdits={pos.receiptTicketEdits}
          professionals={pos.professionals}
          onUpdateReceiptTicketEdit={pos.updateReceiptTicketEdit}
          onSaveReceiptTicketEdits={() => void pos.saveReceiptTicketEdits()}
          isSavingReceiptTickets={pos.isSavingReceiptTickets}
          onOpenPrintPreview={pos.handleOpenPrintPreview}
          isPrintPreviewOpen={pos.isPrintPreviewOpen}
          onClosePrintPreview={() => pos.setIsPrintPreviewOpen(false)}
          onPrint={() => window.print()}
          printFormat={pos.printFormat}
          setPrintFormat={pos.setPrintFormat}
          qrRef={pos.qrRef}
          availabilityPreviewLineId={pos.availabilityPreviewLineId}
          availabilityPreviewDate={pos.availabilityPreviewDate}
          saleBaseDate={pos.saleBaseDate}
          activeAvailabilityLine={pos.activeAvailabilityLine}
          setAvailabilityPreviewLineId={pos.setAvailabilityPreviewLineId}
          setAvailabilityPreviewDate={pos.setAvailabilityPreviewDate}
          setAvailabilitySearch={pos.setAvailabilitySearch}
          availabilitySearch={pos.availabilitySearch}
          occupiedTicketsForPreview={pos.occupiedTicketsForPreview}
          previewHourSlots={pos.previewHourSlots}
          onSelectHourFromPreview={pos.handleSelectHourFromPreview}
          onCloseAvailabilityPreview={() => { pos.setAvailabilityPreviewLineId(null); pos.setAvailabilityPreviewDate(""); pos.setAvailabilitySearch(""); }}
          formatHourMinute={pos.formatHourMinute}
          toDateAndTimeInputValues={pos.toDateAndTimeInputValues}
        />

        <ConfirmDialog
          isOpen={!!pos.confirmCancelSale}
          title="Cancelar venta"
          message={`¿Cancelar la venta ${pos.confirmCancelSale?.sale_code}? Esto cancelará también sus tickets y pagos.`}
          confirmText="Cancelar venta"
          cancelText="No, volver"
          variant="danger"
          onConfirm={() => void pos.executeCancelSale()}
          onCancel={() => pos.setConfirmCancelSale(null)}
          isProcessing={pos.isProcessingConfirm}
        />

        <ConfirmDialog
          isOpen={!!pos.confirmDeleteSale}
          title="Eliminar venta"
          message={`¿Eliminar definitivamente la venta ${pos.confirmDeleteSale?.sale_code}? Esta acción borrará tickets y pagos asociados.`}
          confirmText="Eliminar"
          cancelText="No, volver"
          variant="danger"
          onConfirm={() => void pos.executeDeleteSale()}
          onCancel={() => pos.setConfirmDeleteSale(null)}
          isProcessing={pos.isProcessingConfirm}
        />

        <RegisterClientModal
          isOpen={pos.isRegisterClientOpen}
          onClose={() => pos.setIsRegisterClientOpen(false)}
          onSubmit={pos.handleRegisterClientSubmit}
          eyeTypes={pos.eyeTypes}
          branches={pos.branches}
          eyeTypesError={pos.eyeTypesError}
          isLoadingEyeTypes={pos.isLoadingEyeTypes}
          onRetryEyeTypes={() => void pos.loadEyeTypes()}
          mode="create"
          initialClient={null}
          defaultBranchId={pos.activeBranchId}
        />

        <ProductFormModal
          isOpen={isProductModalOpen}
          isEditing={false}
          isSubmitting={isCreatingProduct}
          form={productForm}
          errors={productFormErrors}
          categories={productCategories}
          onClose={closeProductModal}
          onSubmit={submitProduct}
          onTextChange={(field, value) => setProductForm((current) => ({ ...current, [field]: value }))}
          onNumberChange={(field, value) => {
            const parsed = Number(value);
            setProductForm((current) => ({ ...current, [field]: Number.isNaN(parsed) ? 0 : parsed }));
          }}
          onActiveChange={(active) => setProductForm((current) => ({ ...current, active }))}
        />

        <CategorySelectionModal
          isOpen={pos.isCategoryModalOpen}
          onClose={() => pos.setIsCategoryModalOpen(false)}
          fieldClass={fieldClass}
          serviceCategories={pos.serviceCategories}
          categoryModalSearch={pos.categoryModalSearch}
          onCategoryModalSearchChange={pos.setCategoryModalSearch}
          categoryModalFilterId={pos.categoryModalFilterId}
          onCategoryModalFilterChange={pos.setCategoryModalFilterId}
          onClear={() => { pos.setCategoryModalFilterId("all"); pos.setCategoryModalSearch(""); }}
          filteredModalServices={pos.filteredModalServices}
          selectionCounts={pos.categoryModalSelectionCounts}
          servicesCatalog={pos.services}
          onIncrementSelection={(serviceId) => {
            const service = pos.services.find((s) => String(s.id) === serviceId);
            if (service) pos.addServiceToCart(service);
          }}
          onDecrementSelection={pos.removeLastCartLineForService}
        />

        {showTutorial && (
          <PosTutorialModal
            onClose={() => setShowTutorial(false)}
            setIsCartOpen={pos.setIsCartOpen}
            setDrawerForceStep={setTourDrawerStep}
            storageKey={tutorialStorageKey}
          />
        )}

        <GenericModal
          isOpen={pos.isCashSessionModalOpen}
          onClose={() => pos.setIsCashSessionModalOpen(false)}
          title="Abrir caja"
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => pos.setIsCashSessionModalOpen(false)}
                disabled={pos.isOpeningCashSession}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void pos.handleOpenCashSessionFromPos()}
                disabled={pos.isOpeningCashSession}
                leftIcon={<DoorOpen className="h-4 w-4" />}
              >
                {pos.isOpeningCashSession ? "Abriendo…" : "Abrir caja"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <div>
              <label className={cashLabelClass}>Monto inicial</label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={pos.cashOpeningAmount}
                onChange={(e) => pos.setCashOpeningAmount(e.target.value)}
                placeholder="0.00"
                className={`${cashFieldClass} mt-1`}
              />
            </div>
            <div>
              <label className={cashLabelClass}>Nota (opcional)</label>
              <input
                type="text"
                value={pos.cashOpenNotes}
                onChange={(e) => pos.setCashOpenNotes(e.target.value)}
                placeholder="Ej. turno mañana"
                className={`${cashFieldClass} mt-1`}
              />
            </div>
          </div>
        </GenericModal>

        <GenericModal
          isOpen={pos.isCloseCashSessionModalOpen}
          onClose={() => pos.setIsCloseCashSessionModalOpen(false)}
          title="Cerrar caja"
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => pos.setIsCloseCashSessionModalOpen(false)}
                disabled={pos.isClosingCashSession}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => void pos.handleCloseCashSessionFromPos()}
                disabled={pos.isClosingCashSession || !pos.closeCountedAmount.trim() || !pos.closeNextFundAmount.trim()}
                leftIcon={<DoorOpen className="h-4 w-4" />}
              >
                {pos.isClosingCashSession ? "Cerrando…" : "Cerrar caja"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-xs">
              <p className="font-semibold text-[var(--ui-text)]">Esperado en caja (solo efectivo)</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-[var(--ui-text)]">
                {pos.isLoadingCloseCashDetail ? "…" : `Bs ${(pos.closeCashLiveDetail?.expected_cash ?? 0).toFixed(2)}`}
              </p>
            </div>
            <div>
              <label className={cashLabelClass}>
                Monto contado <span className="text-[var(--ui-text)]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={pos.closeCountedAmount}
                onChange={(e) => pos.setCloseCountedAmount(e.target.value)}
                placeholder="0.00"
                className={`${cashFieldClass} mt-1`}
              />
            </div>
            <div>
              <label className={cashLabelClass}>
                Fondo para el siguiente turno <span className="text-[var(--ui-text)]">*</span>
              </label>
              <input
                type="number"
                min="0"
                max={pos.closeCountedAmount || undefined}
                step="0.01"
                value={pos.closeNextFundAmount}
                onChange={(e) => pos.setCloseNextFundAmount(e.target.value)}
                placeholder="0.00"
                className={`${cashFieldClass} mt-1`}
              />
              <p className="mt-1 text-[11px] font-medium text-[var(--ui-text)]">
                Cuánto del efectivo contado se deja en el cajón como cambio para quien abra la próxima caja.
              </p>
            </div>
            <div>
              <label className={cashLabelClass}>Nota (opcional)</label>
              <input
                type="text"
                value={pos.closeCashNotes}
                onChange={(e) => pos.setCloseCashNotes(e.target.value)}
                placeholder="Ej. faltante justificado, novedades del turno..."
                className={`${cashFieldClass} mt-1`}
              />
            </div>
          </div>
        </GenericModal>
      </div>
    </Layout>
  );
}
