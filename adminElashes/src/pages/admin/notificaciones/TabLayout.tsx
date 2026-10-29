import type { ReactNode } from "react";
import { SectionCard } from "@/components/common/ui";
import type { BranchSelection } from "./hooks/useBranchSelection";
import { RANGOS, fieldClass } from "./notificaciones.utils";

interface TabLayoutProps {
  /** Las pestañas de la página (las dibuja Main). */
  tabs: ReactNode;
  title: string;
  subtitle: string;
  /** Filtros y botones de la derecha. */
  actions?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

/** Cabecera común de las pestañas de Notificaciones y su contenido debajo. */
export default function TabLayout({ tabs, title, subtitle, actions, error, children }: TabLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SectionCard bodyClassName="!p-5 flex flex-col gap-3">
        {tabs}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </SectionCard>
      {error ? (
        <SectionCard bodyClassName="!p-4">
          <p className="text-sm text-rose-600">{error}</p>
        </SectionCard>
      ) : null}
      {children}
    </div>
  );
}

export function EmptyCard({ children }: { children: ReactNode }) {
  return <SectionCard bodyClassName="!p-6">{children}</SectionCard>;
}

interface BranchSelectProps {
  branch: BranchSelection;
  disabled?: boolean;
  className?: string;
}

export function BranchSelect({ branch, disabled, className = fieldClass }: BranchSelectProps) {
  return (
    <select
      value={branch.branchId ?? ""}
      onChange={(event) => branch.setBranchId(event.target.value ? Number(event.target.value) : null)}
      className={className}
      aria-label="Sucursal"
      disabled={disabled}
    >
      <option value="">Todas las sucursales</option>
      {branch.branches.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

interface RangeSelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RangeSelect({ value, onChange, disabled }: RangeSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={fieldClass}
      aria-label="Rango de días"
      disabled={disabled}
    >
      {RANGOS.map((rango) => (
        <option key={rango} value={rango}>
          Próximos {rango} días
        </option>
      ))}
    </select>
  );
}
