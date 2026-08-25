import { Building2, CalendarDays, ShoppingCart } from "lucide-react";
import { setSelectedBranchId } from "../../../core/utils/branch";
import Layout from "../../../components/common/layout";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import RegisterClientModal from "../clients/RegisterClientModal";
import CategorySelectionModal from "./components/CategorySelectionModal";
import SalesHistoryTable from "./components/SalesHistoryTable";
import PosSaleStepOne from "./components/PosSaleStepOne";
import PosSaleStepTwo from "./components/PosSaleStepTwo";
import PosReceiptModals from "./components/PosReceiptModals";
import TodayTicketsSummary from "./components/TodayTicketsSummary";
import { ROWS_PER_PAGE_OPTIONS } from "./pos.constants";
import { usePosPage } from "./usePosPage";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5";

export type PosPageProps = {
  embedded?: boolean;
  initialDate?: string;
  section?: "sale" | "history" | "tickets";
  onCartCountChange?: (count: number) => void;
  onPendingPaymentCountChange?: (count: number) => void;
  cartDrawerSignal?: number;
  onRequestSwitchToPos?: () => void;
};

export default function PosPage({ embedded = false, initialDate, section, onCartCountChange, onPendingPaymentCountChange, cartDrawerSignal }: PosPageProps) {
  const pos = usePosPage({ embedded, initialDate, section, onCartCountChange, onPendingPaymentCountChange, cartDrawerSignal });

  return (
    <Layout
      title={
        embedded ? undefined : (
          <span className="flex w-full items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-tight text-[#323130]">Caja registradora</span>
              <span className="block text-[11px] leading-tight text-[#605e5c]">Punto de venta · Dynamics-style</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 rounded-sm border border-[#edebe9] bg-white px-3 py-1.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <CalendarDays className="h-4 w-4 text-[#0078d4]" />
              <span className="font-medium text-[#323130]">
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
          : "flex h-full min-h-0 flex-col overflow-hidden bg-[#f3f2f1] !px-0 md:!px-0"
      }
      containerClassName={
        embedded
          ? "!border-0 !shadow-none !rounded-none flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent !p-0 max-w-none"
          : "border-0 bg-transparent shadow-none w-full max-w-none !rounded-none !p-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      }
      contentClassName="flex-1 min-h-0 overflow-hidden"
      toolbar={
        <div className="mb-1 mt-1 flex w-full items-center justify-between">
          <div className="inline-flex rounded-sm border border-[#edebe9] bg-[#faf9f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {(["sale", "history", "lastticket"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "sale") pos.resetSaleForm();
                  pos.setActiveTab(tab);
                  pos.setStep(1);
                }}
                className={`rounded-sm px-5 py-2 text-sm font-semibold transition-colors ${
                  pos.activeTab === tab
                    ? "border border-[#edebe9] bg-white text-[#323130] shadow-sm"
                    : "text-[#605e5c] hover:bg-white/70 hover:text-[#323130]"
                }`}
              >
                {tab === "sale" ? "Nueva venta" : tab === "history" ? "Historial" : (
                  <span className="flex items-center gap-1.5">
                    Último ticket
                    {pos.receiptSale && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#107c10] px-1 text-[10px] font-bold text-white">✓</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {pos.activeTab === "sale" && pos.step === 1 && (
              <button
                type="button"
                onClick={() => pos.setIsCartOpen((prev) => !prev)}
                title={pos.isCartOpen ? "Cerrar carrito" : "Ver carrito de venta"}
                className={`relative flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  pos.isCartOpen
                    ? "border-[#0078d4] bg-[#deecf9] text-[#0050a0]"
                    : "border-[#8a8886] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {pos.isCartOpen ? "Cerrar carrito" : "Ver carrito"}
                {pos.cartLines.length > 0 && (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${pos.isCartOpen ? "bg-[#0078d4] text-white" : "bg-[#323130] text-white"}`}>
                    {pos.cartLines.length}
                  </span>
                )}
              </button>
            )}
            {pos.editingSale && (
              <>
                <span className="rounded-sm border border-[#f5d7a1] bg-[#fff4ce] px-3 py-1 text-xs font-semibold text-[#8a6a1f]">
                  Editando venta: {pos.editingSale.sale_code}
                </span>
                <button type="button" onClick={pos.resetSaleForm} className="rounded-sm border border-[#edebe9] bg-white px-3 py-1 text-xs font-semibold text-[#605e5c] hover:bg-[#f3f2f1]">
                  Salir edicion
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden pb-2 [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_select]:cursor-pointer [&_input[type='checkbox']]:cursor-pointer">

        {/* ── No branch selected ───────────────────────────────────────── */}
        {pos.activeTab === "sale" && !pos.activeBranchId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f2f1]">
              <Building2 className="h-8 w-8 text-[#a19f9d]" />
            </div>
            <div className="max-w-sm text-center">
              <p className="text-base font-semibold text-[#323130]">Selecciona una sucursal</p>
              <p className="mt-1.5 text-sm text-[#605e5c]">Para registrar una venta debes elegir una sucursal específica.</p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              {pos.branches.length === 0 ? (
                <p className="text-center text-xs text-[#a19f9d]">Cargando sucursales…</p>
              ) : pos.branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => { setSelectedBranchId(branch.id); pos.setActiveBranchId(branch.id); }}
                  className="flex w-full items-center gap-3 rounded-sm border border-[#edebe9] bg-white px-4 py-3 text-left transition hover:border-[#0078d4] hover:bg-[#eef6ff]"
                >
                  <Building2 className="h-5 w-5 shrink-0 text-[#0078d4]" />
                  <div>
                    <p className="text-sm font-semibold text-[#323130]">{branch.name}</p>
                    {branch.address && <p className="text-xs text-[#605e5c]">{branch.address}</p>}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-[#a19f9d]">También puedes cambiarla desde el selector en la barra superior</p>
          </div>

        /* ── Sale step 1 ─────────────────────────────────────────────── */
        ) : pos.activeTab === "sale" && pos.step === 1 ? (
          <PosSaleStepOne
            labelClass={labelClass}
            fieldClass={fieldClass}
            isLoading={pos.isLoading}
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
            notes={pos.notes}
            setNotes={pos.setNotes}
            onOpenRegisterClient={() => pos.setIsRegisterClientOpen(true)}
            onAddServiceToCart={pos.addServiceToCart}
          />

        /* ── History tab ─────────────────────────────────────────────── */
        ) : pos.activeTab === "history" ? (
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
            filteredSalesCount={pos.filteredSales.length}
            onPageChange={pos.setCurrentPage}
            onViewDetail={pos.setReceiptSale}
            onEditSale={(sale) => void pos.handleEditSaleFromHistory(sale)}
            onCancelSale={(sale) => void pos.handleCancelSaleFromHistory(sale)}
            onDeleteSale={(sale) => void pos.handleDeleteSaleFromHistory(sale)}
            allFilteredSales={pos.filteredSales}
          />

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
      </div>
    </Layout>
  );
}
