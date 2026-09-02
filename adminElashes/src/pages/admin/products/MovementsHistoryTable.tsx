import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, FileDown, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import FilterActionBar from "../../../components/common/FilterActionBar";
import { Button } from "../../../components/common/ui/index";
import DataTable, { type DataTableColumn } from "../../../components/common/table/DataTable";
import { generateTablePdf } from "../../../core/utils/generateTablePdf";
import {
  ProductService,
  type InventoryMovement,
  type InventoryMovementType,
} from "../../../core/services/product/product.service";

type MovementsHistoryTableProps = {
  branchId: number | null;
};

const stripInternalTag = (note?: string) =>
  (note ?? "").replace(/^\[pos_sale:[^\]]+\]\s*/, "").trim();

const TYPE_LABEL: Record<InventoryMovementType, string> = {
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
  service_use: "Uso en servicio",
};

const TYPE_FILTER_OPTIONS: { value: "all" | InventoryMovementType; label: string }[] = [
  { value: "all", label: "Todos los tipos" },
  { value: "in", label: "Entradas" },
  { value: "out", label: "Salidas" },
  { value: "adjustment", label: "Ajustes" },
  { value: "service_use", label: "Uso en servicio" },
];

export default function MovementsHistoryTable({ branchId }: MovementsHistoryTableProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | InventoryMovementType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await ProductService.listMovements({
        branch_id: branchId ?? undefined,
        movement_type: typeFilter === "all" ? undefined : typeFilter,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
      });
      setMovements(data);
    } catch {
      toast.error("No se pudo cargar el historial de movimientos de inventario.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, typeFilter, dateFrom, dateTo]);

  const totalIn = useMemo(
    () => movements.filter((m) => m.movementType === "in").reduce((s, m) => s + m.quantity, 0),
    [movements],
  );
  const totalOut = useMemo(
    () => movements.filter((m) => m.movementType === "out").reduce((s, m) => s + m.quantity, 0),
    [movements],
  );

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Historial de Movimientos de Inventario",
      subtitle: "Entradas, salidas y ajustes de stock registrados",
      filename: "movimientos-inventario",
      orientation: "landscape",
      meta: [
        { label: "Movimientos", value: String(movements.length) },
        { label: "Unidades ingresadas", value: totalIn.toFixed(0) },
        { label: "Unidades salidas", value: totalOut.toFixed(0) },
      ],
      columns: [
        { key: "fecha", header: "Fecha" },
        { key: "productName", header: "Producto" },
        { key: "movementType", header: "Tipo" },
        { key: "quantity", header: "Cantidad" },
        { key: "branchName", header: "Sucursal" },
        { key: "note", header: "Detalle" },
      ],
      rows: movements.map((m) => ({
        fecha: new Date(m.createdAt).toLocaleString("es-BO"),
        productName: `${m.productName} (${m.productSku})`,
        movementType: TYPE_LABEL[m.movementType],
        quantity: String(m.quantity),
        branchName: m.branchName ?? "—",
        note: stripInternalTag(m.note) || "—",
      })),
    });
  };

  const columns: DataTableColumn<InventoryMovement>[] = [
    {
      key: "createdAt",
      header: "Fecha",
      sortable: true,
      getValue: (m) => m.createdAt ?? "",
      render: (m) => (
        <span className="text-slate-500">{new Date(m.createdAt).toLocaleString("es-BO")}</span>
      ),
    },
    {
      key: "productName",
      header: "Producto",
      sortable: true,
      render: (m) => (
        <div>
          <p className="font-semibold text-slate-800">{m.productName}</p>
          <p className="text-[11px] text-slate-400">{m.productSku}</p>
        </div>
      ),
    },
    {
      key: "movementType",
      header: "Tipo",
      sortable: true,
      render: (m) => {
        const isIn = m.movementType === "in";
        const isOut = m.movementType === "out";
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              isIn
                ? "bg-emerald-100 text-emerald-700"
                : isOut
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {isIn ? <ArrowDownCircle className="h-3.5 w-3.5" /> : isOut ? <ArrowUpCircle className="h-3.5 w-3.5" /> : null}
            {TYPE_LABEL[m.movementType]}
          </span>
        );
      },
    },
    {
      key: "quantity",
      header: "Cantidad",
      sortable: true,
      render: (m) => (
        <span className={`font-bold ${m.movementType === "in" ? "text-emerald-600" : m.movementType === "out" ? "text-rose-600" : "text-amber-600"}`}>
          {m.movementType === "in" ? "+" : m.movementType === "out" ? "-" : "±"}
          {m.quantity}
        </span>
      ),
    },
    {
      key: "branchName",
      header: "Sucursal",
      sortable: true,
      render: (m) => <span className="text-slate-600">{m.branchName ?? "—"}</span>,
    },
    {
      key: "note",
      header: "Detalle",
      render: (m) => <span className="text-xs text-slate-500">{stripInternalTag(m.note) || "—"}</span>,
    },
  ];

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-xs font-medium">Filtros:</span>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#094732]"
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#094732]"
          />
          <span className="text-xs text-slate-400">a</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-[#094732]"
          />
          <span className="text-xs text-slate-400">
            {movements.length} movimiento(s) · +{totalIn.toFixed(0)} / -{totalOut.toFixed(0)}
          </span>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadMovements()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
            Actualizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            disabled={movements.length === 0}
            leftIcon={<FileDown className="h-4 w-4" />}
          >
            PDF
          </Button>
        </div>
      }
    />
  );

  return (
    <DataTable
      data={movements}
      columns={columns}
      loading={isLoading}
      renderTopToolbar={renderToolbar}
      globalSearchPlaceholder="Buscar por producto, sucursal o detalle..."
      defaultLimit={15}
      availableLimits={[10, 15, 25, 50]}
    />
  );
}
