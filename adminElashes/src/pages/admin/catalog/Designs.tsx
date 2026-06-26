import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import { Button } from "@/components/common/ui";

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
  { id: 1, name: "Cat Eye Sofisticado", effect: "Cat Eye", eyeType: "Almendrado", design: "Wispy", note: "Alarga la mirada con textura ligera." },
  { id: 2, name: "Doll Luminoso", effect: "Doll", eyeType: "Redondo", design: "Open Eye", note: "Acentua apertura y volumen central." },
  { id: 3, name: "Fox Intenso", effect: "Fox", eyeType: "Caido", design: "Kim K", note: "Eleva la linea externa con picos suaves." },
  { id: 4, name: "Natural Balance", effect: "Natural", eyeType: "Encapotado", design: "Mapping Clasico", note: "Define sin cargar la mirada." },
];

const emptyForm = { name: "", effect: effects[0], eyeType: eyeTypes[0], design: lashDesigns[0], note: "" };

const PAGE_SIZE = 8;

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
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<DesignCombo | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) =>
      [item.name, item.effect, item.eyeType, item.design, item.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [search, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const resetForm = () => setForm(emptyForm);

  const openCreate = () => {
    resetForm();
    setActiveRow(null);
    setModalMode("create");
  };

  const openEdit = (item: DesignCombo) => {
    setActiveRow(item);
    setForm({ name: item.name, effect: item.effect, eyeType: item.eyeType, design: item.design, note: item.note });
    setModalMode("edit");
  };

  const openView = (item: DesignCombo) => {
    setActiveRow(item);
    setModalMode("view");
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
    if (!confirmDeleteItem) return;
    setRows((prev) => prev.filter((item) => item.id !== confirmDeleteItem.id));
    setConfirmDeleteItem(null);
  };

  return (
    <Layout
      title="Diseños"
      subtitle="Combinaciones sugeridas de efectos, tipos de ojo y diseños"
      variant="cards"
      toolbar={
        <FilterActionBar
          left={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar diseño..."
                className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-slate-300"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          }
          right={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Nuevo diseño
            </Button>
          }
        />
      }
    >
      {paginated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No se encontraron diseños.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {paginated.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-slate-50">
                <Sparkles className="h-8 w-8 text-slate-300" />
              </div>
              <div className="border-t border-slate-100 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
                    {item.note ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openView(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                      title="Ver"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteItem(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            Mostrando <b>{(page - 1) * PAGE_SIZE + 1}</b>–<b>{Math.min(page * PAGE_SIZE, filteredRows.length)}</b> de{" "}
            <b>{filteredRows.length}</b>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(1)} disabled={page === 1} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-medium text-slate-600">Pág. {page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

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
                {effects.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Tipo de ojo</label>
              <select
                value={form.eyeType}
                onChange={(event) => setForm((prev) => ({ ...prev, eyeType: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                {eyeTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Diseño</label>
              <select
                value={form.design}
                onChange={(event) => setForm((prev) => ({ ...prev, design: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              >
                {lashDesigns.map((item) => <option key={item} value={item}>{item}</option>)}
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

      <Modal isOpen={Boolean(confirmDeleteItem)} title="Eliminar diseño" onClose={() => setConfirmDeleteItem(null)}>
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            Vas a eliminar el diseño <span className="font-semibold text-slate-800">{confirmDeleteItem?.name}</span>. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmDeleteItem(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
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
