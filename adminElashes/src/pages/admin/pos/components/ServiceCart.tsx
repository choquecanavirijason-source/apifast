import { ShoppingCart, Trash2 } from "lucide-react";
import type { CartLine, ServiceOption } from "../Main";

interface ServiceCartProps {
  cartLines: CartLine[];
  services: ServiceOption[];
  subtotal: number;
  onRemove: (localId: string) => void;
}

export default function ServiceCart({ cartLines, services, subtotal, onRemove }: ServiceCartProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mt-2">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-slate-500" />
          <span className="text-base font-semibold text-slate-700">Carrito de servicios</span>
          {cartLines.length > 0 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {cartLines.length}
            </span>
          )}
        </div>
        {cartLines.length > 0 && (
          <span className="text-sm text-slate-500 font-medium">
            Total: <span className="text-slate-900 font-bold">Bs {subtotal.toFixed(2)}</span>
          </span>
        )}
      </div>
      <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
        {cartLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <ShoppingCart className="h-7 w-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-slate-500">Carrito vacío</p>
              <p className="text-xs text-slate-400 mt-0.5">Selecciona un servicio para comenzar</p>
            </div>
          </div>
        ) : (
          cartLines.map((line) => {
            const service = services.find((s) => String(s.id) === line.service_id);
            return (
              <div key={line.localId} className="group px-6 py-4 transition hover:bg-slate-50/70 flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-3">
                  {service?.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service?.name ?? "Servicio"}
                      className="h-12 w-12 rounded-lg object-cover border border-slate-200 flex-none"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg border border-slate-200">
                      {service?.name?.slice(0, 2).toUpperCase() ?? "S"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{service?.name ?? "Servicio"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-slate-900 block">Bs {line.price.toFixed(2)}</span>
                  <button
                    onClick={() => onRemove(line.localId)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-100 hover:text-red-600"
                    title="Quitar servicio"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
