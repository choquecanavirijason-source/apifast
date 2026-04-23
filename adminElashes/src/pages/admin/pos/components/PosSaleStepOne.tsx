import type { RefObject } from "react";
import { ArrowRight, ShoppingCart, Trash2, ChevronRight } from "lucide-react";
import type { ServiceCategoryOption, ServiceOption } from "../../../../core/services/agenda/agenda.service";
import ServiceSelectorCard from "./ServiceSelectorCard";
import type { PosSaleStepOneProps } from "../pos.types";

export default function PosSaleStepOne({
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
  onRemoveLine,
  onContinue,
}: PosSaleStepOneProps) {
  return (
    <div className={`flex flex-col w-full h-full bg-[#f3f2f1] text-[#323130] ${isLoading ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Header Estilo Dynamics */}
      <div className="flex items-center justify-between bg-white border-b border-[#edebe9] px-6 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          Punto de Venta <ChevronRight className="h-4 w-4 text-[#605e5c]" /> 
          <span className="text-[#605e5c] font-normal">Nuevo Pedido</span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-[#605e5c] uppercase font-bold tracking-wider">Total General</p>
            <p className="text-xl font-bold text-[#0078d4]">Bs {subtotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full overflow-hidden p-4 gap-4">
        {/* Lado Izquierdo: Selección */}
        <div className="flex-[2] flex flex-col gap-4 min-w-0">
          <ServiceSelectorCard
            labelClass="text-sm font-semibold text-[#323130] mb-2 block"
            fieldClass="w-full h-9 border-[#8a8886] rounded-sm focus:border-[#0078d4] focus:ring-0 text-sm"
            serviceSearch={serviceSearch}
            onServiceSearchChange={onServiceSearchChange}
            onServiceInputFocus={onServiceInputFocus}
            onToggleServiceMenu={onToggleServiceMenu}
            isServiceMenuOpen={isServiceMenuOpen}
            serviceMenuPosition={serviceMenuPosition}
            filteredServices={filteredServices}
            onServiceSelect={onServiceSelect}
            selectedServiceCategoryId={selectedServiceCategoryId}
            onCategoryFilterChange={onCategoryFilterChange}
            serviceCategories={serviceCategories}
            onOpenCategoryModal={onOpenCategoryModal}
            quickServices={quickServices}
            onAddServiceToCart={onAddServiceToCart}
            serviceComboboxRef={serviceComboboxRef}
            serviceMenuRef={serviceMenuRef}
          />
        </div>

        {/* Lado Derecho: Carrito/Resumen */}
        <div className="flex-1 flex flex-col bg-white border border-[#edebe9] shadow-sm rounded-sm min-w-[380px]">
          <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#0078d4]" />
            <span className="font-semibold text-sm">Resumen del Pedido ({cartLines.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cartLines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#605e5c] p-8">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm italic">No hay servicios seleccionados</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#edebe9] text-[11px] uppercase text-[#605e5c] bg-[#faf9f8]">
                    <th className="px-4 py-2 font-semibold">Servicio</th>
                    <th className="px-4 py-2 font-semibold text-right">Precio</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f2f1]">
                  {cartLines.map((line) => {
                    const service = services.find((s) => String(s.id) === line.service_id);
                    return (
                      <tr key={line.localId} className="hover:bg-[#f3f2f1] transition-colors group">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-[#323130]">{service?.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold">Bs {line.price.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button 
                            onClick={() => onRemoveLine(line.localId)}
                            className="text-[#a19f9d] hover:text-[#d13438] transition-colors"
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

          {/* Footer del Carrito */}
          <div className="p-4 border-t border-[#edebe9] bg-[#faf9f8]">
            <button
              onClick={onContinue}
              disabled={cartLines.length === 0}
              className={`w-full flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold transition-all
                ${cartLines.length === 0 
                  ? "bg-[#f3f2f1] text-[#a19f9d] cursor-not-allowed" 
                  : "bg-[#0078d4] text-white hover:bg-[#005a9e] shadow-sm active:bg-[#004578]"
                }`}
            >
              Completar Venta <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}