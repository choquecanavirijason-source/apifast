import type { ReactNode } from "react";

interface FilterFieldProps {
  label: string;
  children: ReactNode;
}

export default function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="space-y-1 min-w-[160px]">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
