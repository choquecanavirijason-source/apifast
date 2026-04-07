import { useMemo, useState } from "react";
import Layout from "@/components/common/layout";
import DataTable from "@/components/common/table/DataTable";
import type { DataTableAction, DataTableColumn } from "@/components/common/table/DataTable";
import { Eye, Layers, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";

type DesignCombo = {
  id: number;
  name: string;
  effect: string;
  eyeType: string;
  design: string;
  note: string;
};

const effects = ["Cat Eye", "Doll", "Fox", "Natural"];
const eyeTypes = ["Almendrado", "Redondo", "Caido", "Encapotado"];
const lashDesigns = ["Mapping Clasico", "Wispy", "Kim K", "Open Eye"];

const initialCombinations: DesignCombo[] = [
  {
    id: 1,
    name: "Cat Eye Sofisticado",
    effect: "Cat Eye",
    eyeType: "Almendrado",
    design: "Wispy",
    note: "Alarga la mirada con textura ligera.",
  },
  {
    id: 2,
    name: "Doll Luminoso",
    effect: "Doll",
    eyeType: "Redondo",
    design: "Open Eye",
    note: "Acentua apertura y volumen central.",
  },
  {
    id: 3,
    name: "Fox Intenso",
    effect: "Fox",
    eyeType: "Caido",
    design: "Kim K",
    note: "Eleva la linea externa con picos suaves.",
  },
  {
    id: 4,
    name: "Natural Balance",
    effect: "Natural",
    eyeType: "Encapotado",
    design: "Mapping Clasico",
    note: "Define sin cargar la mirada.",
  },
];

const emptyForm = {
  name: "",
  effect: effects[0],
  eyeType: eyeTypes[0],
  design: lashDesigns[0],
  note: "",
};

type ModalMode = "create" | "edit" | "view" | null;

function Modal({ isOpen, title, onClose, children }: { isOpen: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="text-sm font-semibold">Cerrar</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function DesignsPage() {
  const [rows, setRows] = useState<DesignCombo[]>(initialCombinations);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeRow, setActiveRow] = useState<DesignCombo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<DesignCombo | null>(null);
  const [quickSearch, setQuickSearch] = useState("");

  const counts = useMemo(
    () => ({ effects: effects.length, eyeTypes: eyeTypes.length, designs: lashDesigns.length }),
    []
  );

  const columns: DataTableColumn<DesignCombo>[] = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      render: (item) => <span className="font-semibold text-slate-700">{item.name}</span>,
    },
    {
      key: "effect",
      header: "Efecto",
      sortable: true,
      render: (item) => item.effect,
    },
    {
      key: "eyeType",
      header: "Tipo de ojo",
      sortable: true,
      render: (item) => item.eyeType,
    },
    {
      key: "design",
      header: "Diseño",
      sortable: true,
      render: (item) => item.design,
    },
    {
      key: "note",
      header: "Nota",
      render: (item) => <span className="text-slate-500">{item.note}</span>,
    },
  ];

  const actions: DataTableAction<DesignCombo>[] = [
    {
      label: "Ver",
      icon: <Eye className="h-4 w-4" />,
      onClick: (item) => {
        setActiveRow(item);
        setForm({ name: item.name, effect: item.effect, eyeType: item.eyeType, design: item.design, note: item.note });
        setModalMode("view");
      },
    },
    {
      label: "Editar",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (item) => {
        setActiveRow(item);
        setForm({ name: item.name, effect: item.effect, eyeType: item.eyeType, design: item.design, note: item.note });
        setModalMode("edit");
      },
    },
    {
      label: "Eliminar",
      icon: <Trash2 className="h-4 w-4" />,
      variant: "danger",
      onClick: (item) => setConfirmDelete(item),
    },
  ];

  const resetForm = () => setForm(emptyForm);

  const filteredRows = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) =>
      [item.name, item.effect, item.eyeType, item.design, item.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [quickSearch, rows]);

  const openCreate = () => {
    resetForm();
    setActiveRow(null);
    setModalMode("create");
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveRow(null);
    resetForm();
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    if (modalMode === "edit" && activeRow) {
      setRows((prev) =>
        prev.map((item) =>
          item.id === activeRow.id
            ? { ...item, name, effect: form.effect, eyeType: form.eyeType, design: form.design, note: form.note }
            : item
        )
      );
    }

    if (modalMode === "create") {
      const nextId = rows.length ? Math.max(...rows.map((item) => item.id)) + 1 : 1;
      setRows((prev) => [
        ...prev,
        { id: nextId, name, effect: form.effect, eyeType: form.eyeType, design: form.design, note: form.note },
      ]);
    }

    closeModal();
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    setRows((prev) => prev.filter((item) => item.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  return (
    <Layout
      title={
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>Diseños de pestañas</span>
        </span>
      }
      subtitle="Combinaciones sugeridas de efectos, tipos de ojo y diseños de pestañas"
      variant="table"
      topContent={
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Efectos</p>
                <p className="text-lg font-semibold text-slate-800">{counts.effects}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Eye className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Tipos de ojo</p>
                <p className="text-lg font-semibold text-slate-800">{counts.eyeTypes}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Diseños</p>
                <p className="text-lg font-semibold text-slate-800">{counts.designs}</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <DataTable
        data={filteredRows}
        columns={columns}
        actions={actions}
        enableColumnFilters={true}
        enableGlobalSearch={false}
        renderTopToolbar={() => (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Gestiona combinaciones sugeridas</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  placeholder="Buscar combinacion..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-[#063324]"
              >
                <Plus className="h-4 w-4" />
                Nuevo diseño
              </button>
            </div>
          </div>
        )}
      />

      <Modal
        isOpen={modalMode === "create" || modalMode === "edit"}
        title={modalMode === "edit" ? "Editar diseño" : "Crear diseño"}
        onClose={closeModal}
      >
        <form onSubmit={handleSave} className="grid gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Nombre</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="Nombre del diseño"
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Efecto</label>
              <select
                value={form.effect}
                onChange={(event) => setForm((prev) => ({ ...prev, effect: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                {effects.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Tipo de ojo</label>
              <select
                value={form.eyeType}
                onChange={(event) => setForm((prev) => ({ ...prev, eyeType: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                {eyeTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Diseño</label>
              <select
                value={form.design}
                onChange={(event) => setForm((prev) => ({ ...prev, design: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                {lashDesigns.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Nota</label>
            <textarea
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="mt-2 min-h-[110px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="Descripcion rapida del diseño"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" className="rounded-xl bg-[#094732] px-4 py-2 text-sm font-semibold text-white hover:bg-[#063324]">
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalMode === "view"} title="Detalle del diseño" onClose={closeModal}>
        {activeRow && (
          <div className="grid gap-4 text-sm text-slate-600">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Nombre</p>
              <p className="text-base font-semibold text-slate-800">{activeRow.name}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Efecto</p>
                <p>{activeRow.effect}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Tipo de ojo</p>
                <p>{activeRow.eyeType}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Diseño</p>
                <p>{activeRow.design}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Nota</p>
              <p>{activeRow.note || "Sin nota"}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(confirmDelete)} title="Eliminar diseño" onClose={() => setConfirmDelete(null)}>
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Vas a eliminar el diseño <span className="font-semibold text-slate-800">{confirmDelete?.name}</span>. Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="button" onClick={handleDelete} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600">
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
