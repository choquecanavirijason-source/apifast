import type { ReactNode } from "react";

export type SegmentedTabOption<T extends string> = {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
};

type SegmentedTabsProps<T extends string> = {
  options: readonly SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  right?: ReactNode;
};

export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  right,
}: SegmentedTabsProps<T>) {
  const tabs = (
    <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all [&>svg]:h-3.5 [&>svg]:w-3.5 ${
            value === option.id
              ? "bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm ring-1 ring-black/5"
              : "text-[var(--ui-text-muted)] hover:bg-[var(--ui-surface-hover)]"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );

  if (!right) return tabs;

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">{tabs}</div>
      <div className="flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}
