import { useEffect, useState, type ReactNode } from "react";

const BACKEND_URL = "http://localhost:8000/health";
const MAX_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 800;

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export default function BackendLoader({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isTauri);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    const start = Date.now();

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(BACKEND_URL, { signal: AbortSignal.timeout(1000) });
          if (res.ok) {
            if (!cancelled) setReady(true);
            return;
          }
        } catch {
          // backend aún no responde, seguimos esperando
        }

        const elapsedMs = Date.now() - start;
        if (elapsedMs >= MAX_WAIT_MS) {
          if (!cancelled) setFailed(true);
          return;
        }

        if (!cancelled) setElapsed(Math.floor(elapsedMs / 1000));
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    };

    void poll();
    return () => { cancelled = true; };
  }, []);

  if (ready) return <>{children}</>;

  if (failed) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#f3f2f1]">
        <div className="text-4xl">⚠️</div>
        <p className="text-lg font-semibold text-[#d13438]">No se pudo conectar al servidor</p>
        <p className="text-sm text-[#605e5c]">El backend no respondió después de 60 segundos.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-sm bg-[#0078d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005a9e]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#f3f2f1]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#deecf9] border-t-[#0078d4]" />
      <p className="text-base font-semibold text-[#323130]">Iniciando servidor...</p>
      <p className="text-sm text-[#605e5c]">
        {elapsed > 0 ? `${elapsed}s` : "Conectando al backend"}
      </p>
    </div>
  );
}
