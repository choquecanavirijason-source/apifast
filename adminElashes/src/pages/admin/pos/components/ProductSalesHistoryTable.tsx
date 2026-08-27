import { useMemo } from "react";
import { Package, FileDown } from "lucide-react";
import FilterActionBar from "../../../../components/common/FilterActionBar";
import Button from "../../../../components/common/ui/Button";
import { generateTablePdf } from "../../../../core/utils/generateTablePdf";

import type { PosSaleItem } from "../../../../core/services/pos-sale/pos-sale.service";
import DataTable, { type DataTableColumn } from "../../../../components/common/table/DataTable";

type ProductSaleRow = {
  id: string;
  saleCode: string;
  clientName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
};

type ProductSalesHistoryTableProps = {
  sales: PosSaleItem[];
};

export default function ProductSalesHistoryTable({ sales }: ProductSalesHistoryTableProps) {
  const rows = useMemo<ProductSaleRow[]>(() => {
    const flat: ProductSaleRow[] = [];
    for (const sale of sales) {
      for (const line of sale.product_lines ?? []) {
        flat.push({
          id: `${sale.id}-${line.id}`,
          saleCode: sale.sale_code,
          clientName: `${sale.client?.name ?? ""} ${sale.client?.last_name ?? ""}`.trim(),
          productName: line.product?.name ?? `Producto #${line.product_id}`,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          subtotal: line.subtotal,
          createdAt: sale.created_at,
        });
      }
    }
    return flat.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [sales]);

  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = rows.reduce((s, r) => s + r.subtotal, 0);

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Historial de Productos Vendidos",
      subtitle: "Ventas de productos de inventario registradas en el POS",
      filename: "ventas-productos",
      orientation: "landscape",
      meta: [
        { label: "Líneas", value: String(rows.length) },
        { label: "Unidades", value: String(totalUnits) },
        { label: "Monto total", value: `Bs ${totalAmount.toFixed(2)}` },
      ],
      columns: [
        { key: "saleCode", header: "Venta" },
        { key: "clientName", header: "Cliente" },
        { key: "productName", header: "Producto" },
        { key: "quantity", header: "Cantidad" },
        { key: "unitPrice", header: "Precio unit." },
        { key: "subtotal", header: "Subtotal" },
        { key: "fecha", header: "Fecha" },
      ],
      rows: rows.map((r) => ({
        saleCode: r.saleCode,
        clientName: r.clientName || "—",
        productName: r.productName,
        quantity: String(r.quantity),
        unitPrice: `Bs ${r.unitPrice.toFixed(2)}`,
        subtotal: `Bs ${r.subtotal.toFixed(2)}`,
        fecha: r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-BO") : "—",
      })),
    });
  };

  const columns: DataTableColumn<ProductSaleRow>[] = [
    {
      key: "productName",
      header: "Producto",
      sortable: true,
      render: (r) => <span className="font-semibold text-slate-800">{r.productName}</span>,
    },
    {
      key: "saleCode",
      header: "Venta",
      sortable: true,
      render: (r) => <span className="font-mono text-xs font-bold text-emerald-600">{r.saleCode}</span>,
    },
    {
      key: "clientName",
      header: "Cliente",
      sortable: true,
      render: (r) => <span className="text-slate-700">{r.clientName || "—"}</span>,
    },
    {
      key: "quantity",
      header: "Cantidad",
      sortable: true,
      render: (r) => <span className="font-semibold text-slate-700">{r.quantity}</span>,
    },
    {
      key: "unitPrice",
      header: "Precio unit.",
      sortable: true,
      render: (r) => <span className="text-slate-600">Bs {r.unitPrice.toFixed(2)}</span>,
    },
    {
      key: "subtotal",
      header: "Subtotal",
      sortable: true,
      render: (r) => <span className="font-black text-slate-900">Bs {r.subtotal.toFixed(2)}</span>,
    },
    {
      key: "createdAt",
      header: "Fecha",
      sortable: true,
      getValue: (r) => r.createdAt ?? "",
      render: (r) => (
        <span className="text-slate-500">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-BO") : "—"}
        </span>
      ),
    },
  ];

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-slate-800">Productos vendidos</span>
          <span className="text-xs text-slate-400">
            {rows.length} línea(s) · {totalUnits} unidad(es) · Bs {totalAmount.toFixed(2)}
          </span>
        </div>
      }
      right={
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportPdf}
          disabled={rows.length === 0}
          leftIcon={<FileDown className="h-4 w-4" />}
        >
          PDF
        </Button>
      }
    />
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      renderTopToolbar={renderToolbar}
      globalSearchPlaceholder="Buscar por producto, venta o cliente..."
      defaultLimit={15}
      availableLimits={[10, 15, 25, 50]}
    />
  );
}
