import type { ReactNode } from "react";

interface FilterActionBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export default function FilterActionBar({ left, right, className = "" }: FilterActionBarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">{left}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}
