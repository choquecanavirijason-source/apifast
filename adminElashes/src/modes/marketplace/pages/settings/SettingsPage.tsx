import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader2, RefreshCw, Globe, Database, Plug } from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button, StatCard } from "@/components/common/ui";
import api from "@/core/services/api";
import { fetchAdminProducts } from "@/core/services/marketplace/marketplace.service";
import variables from "@/core/config/variables";

type Status = "loading" | "ok" | "error";
interface BackendStatus {
  elashes: Status; elashesMs?: number; elashesError?: string;
  marketplace: Status; marketplaceMs?: number; marketplaceError?: string;
}

const VITE_API_URL = variables.apiUrl || "http://34.55.150.142/api";

async function pingElashes(): Promise<{ ms: number }> {
  const start = Date.now();
  await api.get("/health");
  return { ms: Date.now() - start };
}

async function pingMarketplace(): Promise<{ ms: number }> {
  const start = Date.now();
  await fetchAdminProducts(false);
  return { ms: Date.now() - start };
}

export default function SettingsPage() {
  const [status, setStatus] = useState<BackendStatus>({
    elashes: "loading", marketplace: "loading",
  });

  const check = async () => {
    setStatus({ elashes: "loading", marketplace: "loading" });
    const [elashesResult, marketplaceResult] = await Promise.allSettled([
      pingElashes(),
      pingMarketplace(),
    ]);
    setStatus({
      elashes: elashesResult.status === "fulfilled" ? "ok" : "error",
      elashesMs: elashesResult.status === "fulfilled" ? elashesResult.value.ms : undefined,
      elashesError: elashesResult.status === "rejected" ? String(elashesResult.reason) : undefined,
      marketplace: marketplaceResult.status === "fulfilled" ? "ok" : "error",
      marketplaceMs: marketplaceResult.status === "fulfilled" ? marketplaceResult.value.ms : undefined,
      marketplaceError: marketplaceResult.status === "rejected" ? String(marketplaceResult.reason) : undefined,
    });
  };

  useEffect(() => { void check(); }, []);

  const allOk = status.elashes === "ok" && status.marketplace === "ok";

  const toolbar = (
    <FilterActionBar
      left={<span className="text-sm text-slate-500">Estado de conexión y configuración</span>}
      right={
        <Button
          variant="secondary"
          onClick={check}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Verificar conexión
        </Button>
      }
    />
  );

  return (
    <Layout
      title="Configuración"
      subtitle="Estado de los backends y variables de entorno del marketplace."
      variant="table"
      toolbar={toolbar}
    >
      {/* Stat cards de estado */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="elashesbackend"
          value={status.elashes === "loading" ? "Verificando…" : status.elashes === "ok" ? `OK · ${status.elashesMs}ms` : "Sin conexión"}
          icon={<Database className="h-4 w-4" />}
          tone={status.elashes === "ok" ? "primary" : status.elashes === "error" ? "amber" : "slate"}
        />
        <StatCard
          label="backend_marketplace (vía proxy)"
          value={status.marketplace === "loading" ? "Verificando…" : status.marketplace === "ok" ? `OK · ${status.marketplaceMs}ms` : "Sin conexión"}
          icon={<Globe className="h-4 w-4" />}
          tone={status.marketplace === "ok" ? "primary" : status.marketplace === "error" ? "amber" : "slate"}
        />
      </div>

      {/* Estado detallado */}
      <section className="mb-4 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Plug className="h-3.5 w-3.5" /> Detalle de backends
          </p>
        </div>
        <BackendRow
          label="elashesbackend"
          description="Backend principal — autenticación, inventario, citas, pagos"
          status={status.elashes}
          ms={status.elashesMs}
          error={status.elashesError}
        />
        <BackendRow
          label="backend_marketplace"
          description="Via proxy de elashesbackend — productos, categorías, pedidos"
          status={status.marketplace}
          ms={status.marketplaceMs}
          error={status.marketplaceError}
        />
      </section>

      {/* URLs activas */}
      <section className="mb-4 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> URLs activas
          </p>
        </div>
        <UrlRow label="Frontend → elashesbackend" value={VITE_API_URL} />
        <UrlRow
          label="Frontend → marketplace (vía proxy)"
          value={`${VITE_API_URL.replace(/\/api\/?$/, "")}/api/marketplace-proxy/…`}
        />
      </section>

      {/* Explicación del proxy */}
      <section className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">¿Cómo funciona el proxy?</p>
        <p className="text-xs leading-relaxed">
          El frontend llama a{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs">/api/marketplace-proxy/…</code>{" "}
          en elashesbackend. Este reenvía la petición internamente a{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs">backend_marketplace</code>{" "}
          usando la variable{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs">MARKETPLACE_BACKEND_URL</code>{" "}
          de su <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs">.env</code>.
          El frontend nunca necesita saber el puerto 8001.
        </p>
      </section>

      {/* Comandos de inicio */}
      <section className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cómo iniciar (desarrollo)</p>
        </div>
        <CodeRow label="elashesbackend (puerto 8000)">
          {`cd elashesbackend\npython -m uvicorn main:app --reload --port 8000`}
        </CodeRow>
        <CodeRow label="backend_marketplace (puerto 8001)">
          {`cd market-place/backend_marketplace\npython -m uvicorn main:app --reload --port 8001 --host 0.0.0.0`}
        </CodeRow>
      </section>
    </Layout>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function BackendRow({
  label, description, status, ms, error,
}: {
  label: string; description: string; status: Status; ms?: number; error?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
        {status === "error" && error && (
          <p className="mt-0.5 text-xs text-rose-600 truncate max-w-xs">{error}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        {status === "ok" && (
          <>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            {ms !== undefined && <span className="text-xs text-slate-400">{ms}ms</span>}
          </>
        )}
        {status === "error" && <XCircle className="h-4 w-4 text-rose-500" />}
      </div>
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="font-mono text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded px-2 py-1 truncate">
        {value}
      </p>
    </div>
  );
}

function CodeRow({ label, children }: { label: string; children: string }) {
  return (
    <div className="px-4 py-3 space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <pre className="rounded-lg bg-slate-900 px-4 py-3 text-xs text-emerald-400 overflow-x-auto leading-relaxed">
        {children}
      </pre>
    </div>
  );
}
