import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "emerald" | "slate" | "amber" | "blue";
  helperText?: string;
  className?: string;
}

const toneClassMap = {
  emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

export default function StatCard({
  label,
  value,
  icon,
  tone = "slate",
  helperText,
  className = "",
}: StatCardProps) {
  return (
    <article
      className={`rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-800">{value}</p>
        </div>
        {icon ? (
          <span className={`inline-flex rounded-lg border px-2 py-1 ${toneClassMap[tone]}`}>{icon}</span>
        ) : null}
      </div>
      {helperText ? <p className="mt-1.5 text-xs leading-snug text-slate-400">{helperText}</p> : null}
    </article>
  );
}
