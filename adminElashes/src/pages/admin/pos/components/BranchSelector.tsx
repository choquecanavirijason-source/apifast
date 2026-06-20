import React from "react";
import { Building2 } from "lucide-react";

type Branch = { id: number; name: string; address?: string | null };

export default function BranchSelector({
  branches,
  onSelect,
}: {
  branches: Branch[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f2f1]">
        <Building2 className="h-8 w-8 text-[#a19f9d]" />
      </div>
      <div className="max-w-sm text-center">
        <p className="text-base font-semibold text-[#323130]">Selecciona una sucursal</p>
        <p className="mt-1.5 text-sm text-[#605e5c]">Para registrar una venta debes elegir una sucursal específica.</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        {branches.length === 0 ? (
          <p className="text-center text-xs text-[#a19f9d]">Cargando sucursales…</p>
        ) : (
          branches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => onSelect(branch.id)}
              className="flex w-full items-center gap-3 rounded-sm border border-[#edebe9] bg-white px-4 py-3 text-left transition hover:border-[#0078d4] hover:bg-[#eef6ff]"
            >
              <Building2 className="h-5 w-5 shrink-0 text-[#0078d4]" />
              <div>
                <p className="text-sm font-semibold text-[#323130]">{branch.name}</p>
                {branch.address && (<p className="text-xs text-[#605e5c]">{branch.address}</p>)}
              </div>
            </button>
          ))
        )}
      </div>
      <p className="text-xs text-[#a19f9d]">También puedes cambiarla desde el selector en la barra superior</p>
    </div>
  );
}
