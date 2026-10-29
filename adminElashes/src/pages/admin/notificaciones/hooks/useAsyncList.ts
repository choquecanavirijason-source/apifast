import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/core/utils/apiError";

/** Carga una lista con estado de carga y error; vuelve a cargar cuando cambia `fetcher`
 *  (memoizarlo con useCallback). Si llega una respuesta vieja, se descarta. */
export function useAsyncList<T>(fetcher: () => Promise<T[]>, errorMessage: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        if (id === requestId.current) setData(result);
      } catch (err) {
        if (id !== requestId.current) return;
        if (!silent) setData([]);
        setError(getApiErrorMessage(err, errorMessage));
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    },
    [fetcher, errorMessage],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, isLoading, error, reload };
}
