import { useEffect, useState } from "react";
import { AppSettingsService, toAbsoluteMediaUrl } from "../services/app-settings/app-settings.service";

/**
 * Caché en memoria (a nivel de módulo) del logo resuelto desde el backend.
 * `undefined` = todavía no se pidió al backend. `null` = ya se pidió y no hay logo.
 */
let cachedLogoUrl: string | null | undefined;
let cachedLogoName: string | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent("logochange"));
}

async function ensureFetched(): Promise<void> {
  if (cachedLogoUrl !== undefined) return;
  if (!inFlight) {
    inFlight = AppSettingsService.getLogo()
      .then((data) => {
        cachedLogoUrl = toAbsoluteMediaUrl(data.logo_url);
        cachedLogoName = data.logo_original_name;
      })
      .catch(() => {
        cachedLogoUrl = null;
        cachedLogoName = null;
      })
      .finally(() => {
        inFlight = null;
        notify();
      });
  }
  await inFlight;
}

/** Lee el logo cacheado (si ya se resolvió) sin hooks; útil en funciones puras como PDFs. */
export async function getLogoUrlForPdf(): Promise<string | null> {
  await ensureFetched();
  return cachedLogoUrl ?? null;
}

/**
 * Hook para gestionar el logo de la aplicación.
 * El logo vive en el backend (compartido entre todos los usuarios); este hook
 * mantiene un caché en memoria y notifica a los componentes suscritos cuando cambia.
 */
export function useLogo() {
  const [logoBase64, setLogoBase64] = useState<string | null | undefined>(cachedLogoUrl);
  const [logoName, setLogoName] = useState<string | null>(cachedLogoName);

  useEffect(() => {
    const sync = () => {
      setLogoBase64(cachedLogoUrl);
      setLogoName(cachedLogoName);
    };
    listeners.add(sync);
    void ensureFetched().then(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  /** Sube un nuevo logo al backend. */
  const saveLogo = async (file: File) => {
    const data = await AppSettingsService.uploadLogo(file);
    cachedLogoUrl = toAbsoluteMediaUrl(data.logo_url);
    cachedLogoName = data.logo_original_name;
    notify();
  };

  /** Elimina el logo guardado. */
  const removeLogo = async () => {
    const data = await AppSettingsService.removeLogo();
    cachedLogoUrl = toAbsoluteMediaUrl(data.logo_url);
    cachedLogoName = data.logo_original_name;
    notify();
  };

  return { logoBase64: logoBase64 ?? null, logoName, saveLogo, removeLogo };
}
