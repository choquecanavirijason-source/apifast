import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, LayoutTemplate, PanelLeft, Pin, PinOff, SlidersHorizontal } from "lucide-react";
import { useLayout, type LayoutMode } from "@/core/context/layout.context";

const sectionLabel =
  "px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ui-text-muted)]";
const optionBase =
  "flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-2 text-left text-[13px] transition-colors focus:outline-none focus-visible:bg-[var(--ui-surface-hover)]";

/** Botón de ajustes del header: elige la posición del menú (lateral/superior) y si el sidebar es fijo. */
export default function LayoutCustomizer() {
  const { layoutMode, setLayoutMode, sidebarPinned, toggleSidebarPinned } = useLayout();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const chooseMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    setOpen(false);
  };

  const modeOption = (mode: LayoutMode, icon: ReactNode, label: string) => {
    const active = layoutMode === mode;
    return (
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={() => chooseMode(mode)}
        className={`${optionBase} ${
          active
            ? "bg-[var(--ui-accent-soft)] font-semibold text-[var(--ui-accent)]"
            : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          {icon}
          {label}
        </span>
        {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Personalizar navegación y diseño"
        title="Personalizar diseño de navegación"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
          open ? "bg-white/14 text-white" : "text-emerald-50/72 hover:bg-white/10 hover:text-white"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Posición del menú"
          className="absolute right-0 top-[calc(100%+6px)] z-[100] w-64 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 text-[var(--ui-text)] shadow-[0_10px_30px_rgba(9,40,29,0.16)]"
        >
          <p className={sectionLabel}>Posición del menú</p>
          <div className="mt-0.5 space-y-1">
            {modeOption("sidebar", <PanelLeft className="h-4 w-4 shrink-0" aria-hidden />, "Barra lateral (Sidebar)")}
            {modeOption("top", <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />, "Barra superior (Top)")}
          </div>

          {layoutMode === "sidebar" && (
            <>
              <div className="-mx-1 my-2 h-px bg-[var(--ui-border)]" />
              <p className={sectionLabel}>Comportamiento del sidebar</p>
              <div className="mt-0.5">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={sidebarPinned}
                  onClick={() => {
                    toggleSidebarPinned();
                    setOpen(false);
                  }}
                  className={`${optionBase} text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)]`}
                >
                  <span className="flex items-center gap-2.5">
                    {sidebarPinned ? (
                      <Pin className="h-4 w-4 shrink-0 text-[var(--ui-accent)]" aria-hidden />
                    ) : (
                      <PinOff className="h-4 w-4 shrink-0 text-[var(--ui-text-muted)]" aria-hidden />
                    )}
                    {sidebarPinned ? "Sidebar Fijo (Expandido)" : "Sidebar Colapsable"}
                  </span>
                  <span className="rounded bg-[var(--ui-surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ui-text-muted)]">
                    {sidebarPinned ? "Fijo" : "Auto"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
