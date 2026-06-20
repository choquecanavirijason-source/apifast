import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "emerald" | "slate" | "amber" | "blue";
  helperText?: string;
  className?: string;
  /** Tamaño reducido para grillas densas */
  compact?: boolean;
}

const toneClassMap = {
  primary: "border-brand-light/40 bg-brand/10 text-brand",
  emerald: "border-brand-light/40 bg-brand/10 text-brand",
  secondary: "border-brand-secondary-light/50 bg-brand-secondary/10 text-brand-secondary",
  tertiary: "border-brand-tertiary-soft/30 bg-black/5 text-brand-tertiary",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

export default function StatCard({
  label,
  value,
  icon,
  tone = "secondary",
  helperText,
  className = "",
  compact = false,
}: StatCardProps) {
  const iconSize = compact ? "size-6" : "size-7";
  const labelClass = compact
    ? "text-[11px] font-medium text-slate-500"
    : "text-xs font-medium text-slate-500";
  const valueClass = compact
    ? "text-xs font-semibold tabular-nums tracking-tight text-brand-tertiary"
    : "text-sm font-semibold tabular-nums tracking-tight text-brand-tertiary";

  return (
    <article
      className={`h-full rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-md border p-1 ${iconSize} ${toneClassMap[tone]}`}
          >
            {icon}
          </span>
        ) : null}

        <span className={`min-w-0 flex-1 truncate ${labelClass}`}>{label}</span>

        <span className={`shrink-0 whitespace-nowrap ${valueClass}`}>{value}</span>
      </div>

      {helperText ? (
        <p className="mt-1 truncate text-xs leading-snug text-brand-secondary">{helperText}</p>
      ) : null}
    </article>
  );
}