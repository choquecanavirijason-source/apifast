import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "emerald" | "slate" | "amber" | "blue";
  helperText?: string;
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
}: StatCardProps) {
  return (
    <article className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-base font-semibold text-slate-800">{value}</p>
        </div>
        {icon ? (
          <span className={`inline-flex rounded border px-1.5 py-0.5 ${toneClassMap[tone]}`}>{icon}</span>
        ) : null}
      </div>
      {helperText ? <p className="mt-1 text-[10px] text-slate-500">{helperText}</p> : null}
    </article>
  );
}
