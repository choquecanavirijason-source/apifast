import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Users, Phone, Mail, ShoppingBag, DollarSign, Calendar } from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { StatCard } from "@/components/common/ui";
import DataTable, { type DataTableColumn } from "@/components/common/table/DataTable";
import { marketplaceApi } from "@/core/services/marketplace/marketplace.service";

interface Customer {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(n: number) {
  return `S/ ${n.toFixed(2)}`;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    marketplaceApi
      .get<Customer[]>("/api/customers")
      .then(({ data }) => setCustomers(data))
      .catch(() => toast.error("No se pudieron cargar los clientes"))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.order_count, 0);
  const repeatCount = customers.filter((c) => c.order_count > 1).length;

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "customer_name",
      header: "Cliente",
      sortable: true,
      render: (c) => {
        const initials = c.customer_name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");
        return (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm">
              {initials || "?"}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{c.customer_name}</p>
              {c.customer_email && (
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Mail className="h-3 w-3" /> {c.customer_email}
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
        <span className="flex items-center gap-1 text-sm text-slate-600">
          <Phone className="h-3.5 w-3.5 text-slate-400" /> {c.customer_phone}
        </span>
      ),
      getValue: (c) => c.customer_phone,
    },
    {
      key: "order_count",
      header: "Pedidos",
      sortable: true,
      render: (c) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          <ShoppingBag className="h-3 w-3" /> {c.order_count}
        </span>
      ),
      getValue: (c) => c.order_count,
    },
    {
      key: "total_spent",
      header: "Total gastado",
      sortable: true,
      render: (c) => (
        <span className="font-semibold text-emerald-700">{formatCurrency(c.total_spent)}</span>
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
  ];

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" />
          <span><strong className="text-slate-800">{customers.length}</strong> clientes registrados</span>
        </div>
      }
    />
  );

  return (
    <Layout title="Clientes" subtitle="Clientes únicos extraídos de los pedidos del marketplace." variant="table" toolbar={toolbar}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total clientes" value={customers.length} icon={<Users className="h-4 w-4" />} tone="slate" />
        <StatCard label="Total pedidos" value={totalOrders} icon={<ShoppingBag className="h-4 w-4" />} tone="slate" />
        <StatCard label="Ingresos totales" value={`S/ ${totalRevenue.toFixed(0)}`} icon={<DollarSign className="h-4 w-4" />} tone="primary" />
        <StatCard label="Clientes frecuentes" value={repeatCount} icon={<Users className="h-4 w-4" />} tone="slate" />
      </div>

      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        defaultLimit={15}
        availableLimits={[10, 15, 30]}
        globalSearchPlaceholder="Buscar cliente, teléfono…"
      />
    </Layout>
  );
}
