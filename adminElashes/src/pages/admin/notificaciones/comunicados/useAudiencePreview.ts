import { useEffect, useState } from "react";
import { BroadcastService, type AudienceParams, type AudiencePreview } from "@/core/services/broadcast/broadcast.service";

const DEBOUNCE_MS = 300;

/** Cuántas clientas recibirían el comunicado con estos filtros. Espera a que
 *  dejen de cambiar y descarta respuestas de filtros anteriores. */
export function useAudiencePreview({ kind, audience, days, branch_id, client_ids }: AudienceParams, enabled: boolean) {
  // Texto estable para el efecto: el arreglo cambia de identidad en cada render.
  const clientKey = (client_ids ?? []).join(",");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      const ids = clientKey ? clientKey.split(",").map(Number) : [];
      BroadcastService.previewAudience({ kind, audience, days, branch_id, client_ids: ids })
        .then((data) => {
          if (cancelled) return;
          setPreview(data);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setIsLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, audience, days, branch_id, clientKey, enabled]);

  return { preview, isLoading, failed };
}
