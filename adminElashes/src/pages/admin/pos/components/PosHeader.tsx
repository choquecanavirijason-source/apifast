import { CalendarDays } from "lucide-react";

interface PosHeaderProps {
  date?: string;
}

export default function PosHeader({ date }: PosHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">Selecciona los servicios</h2>
        <p className="text-sm text-slate-500 mt-1">Busca, filtra y agrega servicios a tu carrito antes de continuar.</p>
      </div>
      <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <span className="font-medium text-slate-600">
          {date || new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>
    </div>
  );
}
