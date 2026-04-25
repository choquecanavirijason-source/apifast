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
      className={`rounded-sm border border-[#edebe9] bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)] ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#323130]">{value}</p>
        </div>
        {icon ? (
          <span className={`inline-flex rounded border px-1.5 py-0.5 ${toneClassMap[tone]}`}>{icon}</span>
        ) : null}
      </div>
      {helperText ? <p className="mt-1.5 text-[10px] leading-snug text-[#605e5c]">{helperText}</p> : null}
    </article>
  );
}
