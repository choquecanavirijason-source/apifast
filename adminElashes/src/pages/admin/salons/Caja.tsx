import { useState } from "react";
import { toast } from "react-toastify";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import Layout from "@/components/common/layout";
import { Button, SectionCard } from "@/components/common/ui";
import DataTable, { type DataTableAction, type DataTableColumn } from "@/components/common/table/DataTable";
import { ExpenseService } from "@/core/services/expense/expense.service";
import { getSelectedBranchId } from "@/core/utils/branch";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

const fieldClass =
  "w-full rounded-sm border border-[#8a8886] bg-white px-3 py-2 text-sm text-[#323130] outline-none transition focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/35";

const moneyFormatter = new Intl.NumberFormat("es-BO", {
  style: "currency",
  currency: "BOB",
  maximumFractionDigits: 2,
});

interface DraftExpense {
  id: string;
  expense_date: string;
  amount: number;
  description: string;
  photoFile: File | null;
  photoName: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function Caja() {
  const [draft, setDraft] = useState<DraftExpense[]>([]);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const total = draft.reduce((s, d) => s + d.amount, 0);

  const addDraft = () => {
    const amt = parseFloat(amount);
    if (!date || Number.isNaN(amt) || amt <= 0 || !description.trim()) {
      toast.warning("Completá fecha, monto y descripción.");
      return;
    }
    setDraft((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        expense_date: date,
        amount: amt,
        description: description.trim(),
        photoFile,
        photoName: photoFile?.name ?? null,
      },
    ]);
    setAmount("");
    setDescription("");
    setPhotoFile(null);
  };

  const removeDraft = (id: string) => {
    setDraft((prev) => prev.filter((d) => d.id !== id));
  };

  const clearAll = () => setDraft([]);

  const saveAll = async () => {
    if (draft.length === 0) return;
    const branchId = getSelectedBranchId();
    if (!branchId) {
      toast.warning("Elegí una sucursal en el selector de arriba antes de guardar.");
      return;
    }
    setSaving(true);
    try {
      for (const item of draft) {
        let photo_url: string | null = null;
        if (item.photoFile) {
          photo_url = await ExpenseService.uploadPhoto(item.photoFile);
        }
        await ExpenseService.create({
          branch_id: branchId,
          amount: item.amount,
          description: item.description,
          expense_date: item.expense_date,
          photo_url,
        });
      }
      toast.success(`${draft.length} gasto${draft.length !== 1 ? "s" : ""} guardado${draft.length !== 1 ? "s" : ""}.`);
      setDraft([]);
    } catch {
      toast.error("No se pudieron guardar los gastos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    void generateTablePdf({
      title: "Caja — Registro de gastos",
      subtitle: `Total: ${moneyFormatter.format(total)} · ${draft.length} gasto${draft.length !== 1 ? "s" : ""}`,
      filename: "registro-de-gastos",
      columns: [
        { header: "Fecha", key: "expense_date" },
        { header: "Monto", key: "amount" },
        { header: "Descripción", key: "description" },
        { header: "Foto", key: "photo" },
      ],
      rows: draft.map((d) => ({
        expense_date: d.expense_date,
        amount: moneyFormatter.format(d.amount),
        description: d.description,
        photo: d.photoName ?? "—",
      })),
    });
  };

  const columns: DataTableColumn<DraftExpense>[] = [
    {
      key: "expense_date",
      header: "Fecha",
      sortable: true,
      render: (d) => <span className="text-xs text-[#323130]">{d.expense_date}</span>,
    },
    {
      key: "amount",
      header: "Monto",
      sortable: true,
      getValue: (d) => d.amount,
      render: (d) => (
        <span className="text-xs font-semibold tabular-nums text-[#323130]">
          {moneyFormatter.format(d.amount)}
        </span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      sortable: true,
      render: (d) => <span className="text-xs text-[#323130]">{d.description}</span>,
    },
    {
      key: "photo",
      header: "Foto",
      render: (d) => <span className="text-xs text-[#605e5c]">{d.photoName ?? "—"}</span>,
    },
  ];

  const actions: DataTableAction<DraftExpense>[] = [
    {
      label: "Quitar",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (d) => removeDraft(d.id),
      variant: "danger",
    },
  ];

  return (
    <Layout title="Caja" subtitle="Registro de gastos de la sucursal activa." variant="cards">
      <SectionCard title="Registro de gastos">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} mt-1`} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Monto</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${fieldClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Foto (opcional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className={`${fieldClass} mt-1 py-1.5`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#605e5c]">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del gasto"
              className={`${fieldClass} mt-1`}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={addDraft} leftIcon={<Plus className="h-4 w-4" />}>
            Agregar
          </Button>
        </div>

        <div className="mt-5">
          <DataTable
            data={draft}
            columns={columns}
            actions={actions}
            enableGlobalSearch={false}
            enableColumnFilters={false}
            defaultLimit={10}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[#605e5c]">
            Total de gastos: {draft.length}
            {draft.length > 0 ? ` · ${moneyFormatter.format(total)}` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={draft.length === 0}
              leftIcon={<Download className="h-4 w-4" />}
            >
              PDF
            </Button>
            <Button variant="secondary" onClick={clearAll} disabled={draft.length === 0 || saving}>
              Limpiar todo
            </Button>
            <Button onClick={() => void saveAll()} disabled={draft.length === 0 || saving} leftIcon={<Save className="h-4 w-4" />}>
              {saving ? "Guardando…" : "Guardar gastos"}
            </Button>
          </div>
        </div>
      </SectionCard>
    </Layout>
  );
}
