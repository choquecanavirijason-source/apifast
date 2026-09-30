import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** Posición del menú principal: barra lateral o barra superior. */
export type LayoutMode = "sidebar" | "top";

interface LayoutContextValue {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  /** true = sidebar fijo (expandido); false = colapsable (solo iconos, se abre al pasar el mouse). */
  sidebarPinned: boolean;
  setSidebarPinned: (pinned: boolean) => void;
  toggleSidebarPinned: () => void;
}

const STORAGE_KEY_MODE = "elashes_layout_mode";
const STORAGE_KEY_PINNED = "elashes_sidebar_pinned";

const LayoutContext = createContext<LayoutContextValue | null>(null);

// Se lee en el estado inicial para que al recargar no parpadee el modo por defecto.
const readMode = (): LayoutMode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    return saved === "sidebar" || saved === "top" ? saved : "top";
  } catch {
    return "top";
  }
};

const readPinned = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PINNED);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
};

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(readMode);
  const [sidebarPinned, setSidebarPinnedState] = useState<boolean>(readPinned);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {
      // localStorage puede fallar en modo privado — simplemente no se recuerda.
    }
  }, []);

  const setSidebarPinned = useCallback((pinned: boolean) => {
    setSidebarPinnedState(pinned);
    try {
      localStorage.setItem(STORAGE_KEY_PINNED, String(pinned));
    } catch {
      // localStorage puede fallar en modo privado — simplemente no se recuerda.
    }
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      layoutMode,
      setLayoutMode,
      sidebarPinned,
      setSidebarPinned,
      toggleSidebarPinned: () => setSidebarPinned(!sidebarPinned),
    }),
    [layoutMode, setLayoutMode, sidebarPinned, setSidebarPinned],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error("useLayout debe usarse dentro de LayoutProvider");
  return context;
}
