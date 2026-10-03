import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useLogo } from "@/core/hooks/useLogo";
import { useLayout } from "@/core/context/layout.context";
import NavigationList from "./NavigationList";

function BrandLink({ showName, nameClassName = "" }: { showName: boolean; nameClassName?: string }) {
  const { logoBase64 } = useLogo();
  return (
    <NavLink
      to="/"
      className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
      aria-label="Ir a Visión general"
    >
      {logoBase64 ? (
        <img src={logoBase64} alt="E-lashes" className="h-8 w-8 shrink-0 rounded-lg bg-white/94 object-contain p-0.5" />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs font-bold">
          E
        </span>
      )}
      {showName && (
        <span className={`overflow-hidden whitespace-nowrap text-[14px] font-semibold tracking-tight ${nameClassName}`}>
          E-Lashes
        </span>
      )}
    </NavLink>
  );
}

/** Barra lateral de escritorio: 256px fija, o 64px (solo iconos) que se expande al pasar el mouse. */
export default function SidebarNavigation() {
  const { layoutMode, sidebarPinned } = useLayout();
  if (layoutMode !== "sidebar") return null;

  return (
    <aside
      className={`group/rail relative z-[45] hidden h-full shrink-0 flex-col overflow-hidden border-r border-black/15 bg-[#094732] shadow-[4px_0_18px_rgba(3,38,26,0.14)] transition-[width] duration-300 ease-in-out md:flex ${
        sidebarPinned ? "w-64" : "w-16 hover:w-64"
      }`}
    >
      <div className="flex h-13 shrink-0 items-center border-b border-white/8 px-4">
        <BrandLink
          showName
          nameClassName={
            sidebarPinned
              ? "max-w-40 opacity-100"
              : "max-w-0 opacity-0 transition-all duration-300 group-hover/rail:max-w-40 group-hover/rail:opacity-100"
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:thin]">
        <NavigationList rail railExpanded={sidebarPinned} />
      </div>
    </aside>
  );
}

/** Menú de celular: panel que se desliza desde la izquierda (en ambos modos). */
export function MobileNavigationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  useEffect(() => {
    onClose();
    // Cerrar al cambiar de página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[120] md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#094732] shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-white/8 px-4">
          <BrandLink showName />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-50/72 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavigationList onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
