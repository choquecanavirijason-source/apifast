import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Users, Mail, ShoppingBag, DollarSign, Calendar, TrendingUp, Store, Smartphone } from "lucide-react";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.05 2C6.5 2 2 6.5 2 12.04c0 1.98.55 3.87 1.6 5.53L2.05 22l4.55-1.5a10.03 10.03 0 0 0 5.45 1.6h.005c5.55 0 10.05-4.5 10.05-10.04C22.1 6.53 17.6 2 12.05 2Zm0 18.34h-.004a8.3 8.3 0 0 1-4.24-1.16l-.304-.18-3.15 1.03 1.05-3.06-.198-.315a8.28 8.28 0 0 1-1.27-4.42c0-4.59 3.74-8.32 8.34-8.32 2.23 0 4.32.87 5.9 2.45a8.27 8.27 0 0 1 2.44 5.88c0 4.59-3.75 8.32-8.31 8.32Z" />
    </svg>
  );
}

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import {
  fetchCustomers,
  type MarketplaceCustomer,
} from "@/core/services/marketplace/marketplace.service";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(n: number) {
  return `S/ ${n.toFixed(2)}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

// Paleta de colores para los avatares según índice
const AVATAR_COLORS = [
  "bg-brand/10 text-brand",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<MarketplaceCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCustomers()
      .then(setCustomers)
      .catch(() => toast.error("No se pudieron cargar los clientes"))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.order_count, 0);
  const repeatCount = customers.filter((c) => c.order_count > 1).length;
  const avgSpend = customers.length ? totalRevenue / customers.length : 0;
  const appCount = customers.filter((c) => c.source === "app").length;
  const salonCount = customers.filter((c) => c.source === "salon").length;

  const columns: DataTableColumn<MarketplaceCustomer>[] = [
    {
      key: "customer_name",
      header: "Cliente",
      sortable: true,
      render: (c) => {
        const idx = customers.indexOf(c);
        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        return (
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${color}`}>
              {getInitials(c.customer_name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{c.customer_name}</p>
              {c.customer_email && (
                <p className="flex items-center gap-1 text-xs text-slate-500 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> {c.customer_email}
                </p>
              )}
            </div>
          </div>
        );
      },
      getValue: (c) => c.customer_name,
    },
    {
      key: "customer_phone",
      header: "Teléfono",
      sortable: true,
      render: (c) => (
        <a
          href={`https://wa.me/${c.customer_phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 transition font-medium"
        >
          <WhatsAppIcon className="h-3.5 w-3.5" /> {c.customer_phone}
        </a>
      ),
      getValue: (c) => c.customer_phone,
    },
    {
      key: "order_count",
      header: "Pedidos",
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
            <ShoppingBag className="h-3 w-3" /> {c.order_count}
          </span>
          {c.order_count > 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">
              <TrendingUp className="h-2.5 w-2.5" /> Frecuente
            </span>
          )}
        </div>
      ),
      getValue: (c) => c.order_count,
    },
    {
      key: "total_spent",
      header: "Total gastado",
      sortable: true,
      render: (c) => (
        <span className="font-bold text-slate-800">{formatCurrency(c.total_spent)}</span>
      ),
      getValue: (c) => c.total_spent,
    },
    {
      key: "last_order_at",
      header: "Último pedido",
      sortable: true,
      render: (c) => (
        <span className="flex items-center gap-1 text-sm text-slate-500">
          <Calendar className="h-3.5 w-3.5" /> {formatDate(c.last_order_at)}
        </span>
      ),
      getValue: (c) => c.last_order_at,
    },
    {
      key: "source",
      header: "Origen",
      sortable: true,
      render: (c) =>
        c.source === "app" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            <Smartphone className="h-3 w-3" /> App
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <Store className="h-3 w-3" /> Salón
          </span>
        ),
      getValue: (c) => c.source,
    },
  ];

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" />
          <span>
            <strong className="text-slate-800">{customers.length}</strong> clientes —{" "}
            <strong className="text-slate-800">{repeatCount}</strong> frecuentes —{" "}
            <Smartphone className="inline h-3.5 w-3.5 text-blue-500" />{" "}
            <strong className="text-blue-700">{appCount}</strong> app ·{" "}
            <Store className="inline h-3.5 w-3.5 text-emerald-600" />{" "}
            <strong className="text-emerald-700">{salonCount}</strong> salón
          </span>
        </div>
      }
    />
  );

  return (
    <Layout
      title="Clientes"
      subtitle="Clientes únicos del marketplace, ordenados por mayor gasto."
      variant="table"
      toolbar={toolbar}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total clientes"
          value={customers.length}
          icon={<Users className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Total pedidos"
          value={totalOrders}
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Ingresos totales"
          value={`S/ ${totalRevenue.toFixed(0)}`}
          icon={<DollarSign className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Ticket promedio"
          value={`S/ ${avgSpend.toFixed(0)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Desde la App"
          value={appCount}
          icon={<Smartphone className="h-4 w-4" />}
          tone="secondary"
        />
        <StatCard
          label="Desde el Salón"
          value={salonCount}
          icon={<Store className="h-4 w-4" />}
          tone="slate"
        />
      </div>

      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        defaultLimit={15}
        availableLimits={[10, 15, 30, 50]}
        globalSearchPlaceholder="Buscar por nombre, teléfono o email…"
      />
    </Layout>
  );
}
