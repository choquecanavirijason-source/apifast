import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type CalendarScope = "day" | "week" | "month" | "year";

const OPTIONS: Array<{ id: CalendarScope; label: string; shortcut: string }> = [
  { id: "day", label: "Día", shortcut: "D" },
  { id: "week", label: "Semana", shortcut: "S" },
  { id: "month", label: "Mes", shortcut: "M" },
  { id: "year", label: "Año", shortcut: "A" },
];

type CalendarScopeMenuProps = {
  value: CalendarScope;
  onChange: (scope: CalendarScope) => void;
};

/** Selector de vista Día / Semana / Mes / Año (como Google Calendar), con atajos de teclado D, S, M y A. */
export default function CalendarScopeMenu({ value, onChange }: CalendarScopeMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      // Atajos solo si no se está escribiendo en un campo.
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const option = OPTIONS.find((o) => o.shortcut.toLowerCase() === event.key.toLowerCase());
      if (option) {
        onChange(option.id);
        setOpen(false);
      }
    };
    const closeOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", closeOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", closeOutside);
    };
  }, [onChange]);

  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  return (
    <div className="relative shrink-0" ref={containerRef} data-tour="agenda-scope">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar vista (D, S, M, A)"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] px-3 text-xs font-semibold text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-hover)]"
      >
        {current.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Vista del calendario"
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-44 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-[0_10px_30px_rgba(9,40,29,0.16)]"
        >
          {OPTIONS.map((option) => {
            const active = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  active
                    ? "bg-[var(--ui-accent-soft)] font-semibold text-[var(--ui-accent)]"
                    : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Check className={`h-3.5 w-3.5 ${active ? "" : "invisible"}`} aria-hidden />
                  {option.label}
                </span>
                <kbd className="font-mono text-[11px] text-[var(--ui-text-muted)]">{option.shortcut}</kbd>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
