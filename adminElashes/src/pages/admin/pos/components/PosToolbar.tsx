import React from "react";
import { CalendarDays, ShoppingCart } from "lucide-react";

type Props = {
  embedded?: boolean;
  activeTab: "sale" | "history" | "lastticket";
  setActiveTab: (t: "sale" | "history" | "lastticket") => void;
  resetSaleForm: () => void;
  step: 1 | 2;
  setStep: (s: 1 | 2) => void;
  isCartOpen: boolean;
  setIsCartOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  cartLinesCount: number;
  editingSale: { sale_code?: string } | null;
  receiptSaleId?: number | null;
  receiptSale?: any;
};

export default function PosToolbar({
  embedded,
  activeTab,
  setActiveTab,
  resetSaleForm,
  step,
  setStep,
  isCartOpen,
  setIsCartOpen,
  cartLinesCount,
  editingSale,
  receiptSale,
}: Props) {
  return (
    <div className="mb-1 mt-1 flex w-full items-center justify-between">
      <div className="inline-flex  rounded-sm border border-[#edebe9] bg-[#faf9f8]  shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {(["sale", "history", "lastticket"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (tab === "sale") resetSaleForm();
              setActiveTab(tab);
              setStep(1);
            }}
            className={`rounded-sm px-5 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "border border-[#edebe9] bg-white text-[#323130] shadow-sm"
                : "text-[#605e5c] hover:bg-white/70 hover:text-[#323130]"
            }`}
          >
            {tab === "sale" ? "Nueva venta" : tab === "history" ? "Historial" : (
              <span className="flex items-center gap-1.5">
                Último ticket
                {receiptSale && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#107c10] px-1 text-[10px] font-bold text-white">
                    ✓
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {activeTab === "sale" && step === 1 ? (
          <button
            type="button"
            onClick={() => setIsCartOpen((prev) => !prev)}
            title={isCartOpen ? "Cerrar carrito" : "Ver carrito de venta"}
            className={`relative flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isCartOpen
                ? "border-[#094732] bg-[#ecfdf5] text-[#094732]"
                : "border-[#8a8886] bg-white text-[#605e5c] hover:bg-[#f3f2f1]"
            }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {isCartOpen ? "Cerrar carrito" : "Ver carrito"}
            {cartLinesCount > 0 ? (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${isCartOpen ? "bg-[#094732] text-white" : "bg-[#323130] text-white"}`}>
                {cartLinesCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {editingSale ? (
          <>
            <span className="rounded-sm border border-[#f5d7a1] bg-[#fff4ce] px-3 py-1 text-xs font-semibold text-[#8a6a1f]">
              Editando venta: {editingSale.sale_code}
            </span>
            <button
              type="button"
              onClick={resetSaleForm}
              className="rounded-sm border border-[#edebe9] bg-white px-3 py-1 text-xs font-semibold text-[#605e5c] hover:bg-[#f3f2f1]"
            >
              Salir edicion
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
