import { useState, useEffect } from "react";

const LOGO_KEY = "ui:logo";
const LOGO_NAME_KEY = "ui:logo_name";

/** Lee el logo guardado sin hooks (útil en funciones puras como la generación de PDF). */
export function getLogoBase64(): string | null {
  try {
    return localStorage.getItem(LOGO_KEY);
  } catch {
    return null;
  }
}

/**
 * Hook para gestionar el logo de la aplicación.
 * Persiste en localStorage y sincroniza entre componentes via evento custom "logochange".
 */
export function useLogo() {
  const [logoBase64, setLogoBase64] = useState<string | null>(() => {
    try { return localStorage.getItem(LOGO_KEY); } catch { return null; }
  });
  const [logoName, setLogoName] = useState<string | null>(() => {
    try { return localStorage.getItem(LOGO_NAME_KEY); } catch { return null; }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setLogoBase64(localStorage.getItem(LOGO_KEY));
        setLogoName(localStorage.getItem(LOGO_NAME_KEY));
      } catch { /* noop */ }
    };
    window.addEventListener("logochange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("logochange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Guarda un nuevo logo (base64 data URL). */
  const saveLogo = (base64: string, name: string) => {
    try {
      localStorage.setItem(LOGO_KEY, base64);
      localStorage.setItem(LOGO_NAME_KEY, name);
      setLogoBase64(base64);
      setLogoName(name);
      window.dispatchEvent(new CustomEvent("logochange"));
    } catch (e) {
      console.error("[useLogo] Error guardando logo:", e);
      throw new Error("El archivo es demasiado grande para guardarlo localmente.");
    }
  };

  /** Elimina el logo guardado. */
  const removeLogo = () => {
    try {
      localStorage.removeItem(LOGO_KEY);
      localStorage.removeItem(LOGO_NAME_KEY);
      setLogoBase64(null);
      setLogoName(null);
      window.dispatchEvent(new CustomEvent("logochange"));
    } catch { /* noop */ }
  };

  return { logoBase64, logoName, saveLogo, removeLogo };
}
