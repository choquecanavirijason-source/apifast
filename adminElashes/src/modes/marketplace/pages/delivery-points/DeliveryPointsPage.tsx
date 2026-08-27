import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MapPin, Plus, Pencil, Trash2, Eye, EyeOff, Globe2, Building2, FileDown } from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, StatCard } from "@/components/common/ui";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import DataTable, { type DataTableColumn, type DataTableAction } from "@/components/common/table/DataTable";
import api from "@/core/services/api";
import { generateTablePdf } from "@/core/utils/generateTablePdf";

import {
  fetchAdminDeliveryPoints,
  createDeliveryPoint,
  updateDeliveryPoint,
  deleteDeliveryPoint,
  type MarketplaceDeliveryPoint,
} from "@/core/services/marketplace/marketplace.service";

// Sucursales del salón, para poder elegir una y autocompletar el punto de
// entrega en vez de tipear todo a mano. Mismo endpoint público que ya usa
// la app móvil para "Punto de recojo" (booking-public/branches) — vive en
// elashesbackend, no en el marketplace, por eso se llama directo con `api`
// (sin el prefijo /marketplace-proxy) y devuelve country_code/country_name,
// a diferencia de BranchService.list() que no los trae.
interface SalonBranch {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  country_code: string | null;
  country_name: string | null;
}

async function fetchSalonBranches(): Promise<SalonBranch[]> {
  const { data } = await api.get<SalonBranch[]>("/booking-public/branches");
  return data;
}

// ── países disponibles para asignar a un punto de entrega ─────────────────────
// Lista curada (no viene del backend): el admin elige de acá y el código
// (ISO 3166-1 alpha-2) es lo que la app usa para filtrar los puntos por país.
const COUNTRIES = [
  { code: "PE", name: "Perú" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "EC", name: "Ecuador" },
  { code: "BO", name: "Bolivia" },
  { code: "AR", name: "Argentina" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
] as const;

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

// ── helpers ───────────────────────────────────────────────────────────────────

type Form = {
  country_code: string;
  city: string;
  name: string;
  address: string;
  maps_url: string;
  reference: string;
  schedule: string;
  phone: string;
  sort_order: number;
  branch_id: number | null;
};

const emptyForm: Form = {
  country_code: COUNTRIES[0].code,
  city: "",
  name: "",
  address: "",
  maps_url: "",
  reference: "",
  schedule: "",
  phone: "",
  sort_order: 0,
  branch_id: null,
};

// ── page ──────────────────────────────────────────────────────────────────────

export default function DeliveryPointsPage() {
  const [points, setPoints] = useState<MarketplaceDeliveryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<MarketplaceDeliveryPoint | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const [branches, setBranches] = useState<SalonBranch[]>([]);

  // ── data ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      setPoints(await fetchAdminDeliveryPoints());
    } catch {
      toast.error("No se pudieron cargar los puntos de entrega");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Si falla, simplemente no se ofrece el selector de sucursal — el
    // formulario sigue funcionando a mano como siempre.
    fetchSalonBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  // Autocompleta país/ciudad/nombre/dirección con los datos de la sucursal
  // elegida — el admin puede seguir editando cualquier campo después, y
  // agregar referencia/horario/teléfono que la sucursal no tiene.
  const handleBranchSelect = (branchId: string) => {
    if (!branchId) {
      setForm((f) => ({ ...f, branch_id: null }));
      return;
    }
    const branch = branches.find((b) => b.id === Number(branchId));
    if (!branch) return;
    setForm((f) => ({
      ...f,
      branch_id: branch.id,
      country_code: branch.country_code ?? f.country_code,
      city: branch.city ?? f.city,
      name: branch.name,
      address: branch.address ?? f.address,
    }));
  };

  // ── form ─────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: MarketplaceDeliveryPoint) => {
    setEditingId(p.id);
    setForm({
      country_code: p.country_code,
      city: p.city ?? "",
      name: p.name,
      address: p.address,
      maps_url: p.maps_url ?? "",
      reference: p.reference ?? "",
      schedule: p.schedule ?? "",
      phone: p.phone ?? "",
      sort_order: p.sort_order,
      branch_id: p.branch_id,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Nombre y dirección son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        country_code: form.country_code,
        country_name: countryName(form.country_code),
        city: form.city.trim() || undefined,
        name: form.name.trim(),
        address: form.address.trim(),
        maps_url: form.maps_url.trim() || undefined,
        reference: form.reference.trim() || undefined,
        schedule: form.schedule.trim() || undefined,
        phone: form.phone.trim() || undefined,
        sort_order: Number(form.sort_order) || 0,
        branch_id: form.branch_id,
      };
      if (editingId !== null) {
        const updated = await updateDeliveryPoint(editingId, payload);
        setPoints((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        toast.success("Punto de entrega actualizado");
      } else {
        const created = await createDeliveryPoint(payload);
        setPoints((prev) => [...prev, created]);
        toast.success("Punto de entrega creado");
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── toggle / delete ────────────────────────────────────────────────────────

  const handleToggle = async (p: MarketplaceDeliveryPoint) => {
    setToggling(p.id);
    try {
      const updated = await updateDeliveryPoint(p.id, { is_active: !p.is_active });
      setPoints((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    } catch {
      toast.error("No se pudo cambiar el estado");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDeliveryPoint(deleteTarget.id);
      setPoints((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("Punto de entrega eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const usedCountries = useMemo(
    () => [...new Set(points.map((p) => p.country_code))].sort(),
    [points]
  );
  const filteredPoints =
    countryFilter === "all" ? points : points.filter((p) => p.country_code === countryFilter);
  const activeCount = points.filter((p) => p.is_active).length;

  const handleExportPdf = () => {
    void generateTablePdf({
      title: "Puntos de Entrega",
      filename: "puntos-entrega-marketplace",
      orientation: "landscape",
      meta: [
        { label: "Puntos", value: String(filteredPoints.length) },
        { label: "Activos", value: String(activeCount) },
      ],
      columns: [
        { key: "country", header: "País" },
        { key: "name", header: "Punto de entrega" },
        { key: "address", header: "Dirección" },
        { key: "is_active", header: "Estado" },
      ],
      rows: filteredPoints.map((p) => ({
        country: p.country_name,
        name: p.name,
        address: p.address,
        is_active: p.is_active ? "Activo" : "Inactivo",
      })),
    });
  };

  const columns: DataTableColumn<MarketplaceDeliveryPoint>[] = [
    {
      key: "country",
      header: "País",
      sortable: true,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Globe2 className="h-3.5 w-3.5 text-brand" /> {p.country_name}
        </span>
      ),
      getValue: (p) => p.country_name,
    },
    {
      key: "name",
      header: "Punto de entrega",
      sortable: true,
      render: (p) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{p.name}</p>
          <p className="text-xs text-slate-400">{p.city ?? "—"}</p>
        </div>
      ),
      getValue: (p) => p.name,
    },
    {
      key: "address",
      header: "Dirección",
      render: (p) => (
        <p className="max-w-xs truncate text-sm text-slate-600">{p.address}</p>
      ),
      getValue: (p) => p.address,
    },
    {
      key: "is_active",
      header: "Estado",
      sortable: true,
      render: (p) => (
        <button
          onClick={() => void handleToggle(p)}
          disabled={toggling === p.id}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
            p.is_active
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              : "bg-rose-100 text-rose-700 hover:bg-rose-200"
          }`}
        >
          {p.is_active ? <><Eye className="h-3 w-3" /> Activo</> : <><EyeOff className="h-3 w-3" /> Inactivo</>}
        </button>
      ),
      getValue: (p) => (p.is_active ? "activo" : "inactivo"),
    },
  ];

  const actions: DataTableAction<MarketplaceDeliveryPoint>[] = [
    { label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: openEdit },
    { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onClick: (p) => setDeleteTarget(p), variant: "danger" },
  ];

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 outline-none focus:border-brand"
          >
            <option value="all">Todos los países</option>
            {usedCountries.map((code) => (
              <option key={code} value={code}>{countryName(code)}</option>
            ))}
          </select>
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportPdf} leftIcon={<FileDown className="h-4 w-4" />}>
            PDF
          </Button>
          <Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo punto de entrega
          </Button>
        </div>
      }
    />
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Layout
        title="Puntos de entrega"
        subtitle="Locales de recojo/entrega por país. El cliente elige su país en la app y ve solo los puntos habilitados ahí."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total puntos" value={points.length} icon={<MapPin className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activos" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
          <StatCard label="Países con cobertura" value={usedCountries.length} icon={<Globe2 className="h-4 w-4" />} tone="slate" />
        </div>

        <DataTable
          data={filteredPoints}
          columns={columns}
          actions={actions}
          loading={loading}
          defaultLimit={10}
          availableLimits={[5, 10, 20]}
          globalSearchPlaceholder="Buscar punto de entrega…"
        />
      </Layout>

      {/* ── Modal crear / editar ─────────────────────────────────────────────── */}
      <GenericModal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingId ? "Editar punto de entrega" : "Nuevo punto de entrega"}
        size="sm"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear punto"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {branches.length > 0 && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-brand-tertiary">
                <Building2 className="h-4 w-4" />
                Sucursal del salón
              </label>
              <select
                value={form.branch_id ?? ""}
                onChange={(e) => handleBranchSelect(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Sin sucursal (cargar a mano)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.city ?? b.country_name ?? ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">País</label>
              <select
                value={form.country_code}
                onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Ciudad</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Lima"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Nombre del punto</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Local Miraflores"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Dirección</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Av. Larco 123"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Link de Google Maps (opcional)</label>
            <input
              type="text"
              value={form.maps_url}
              onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <p className="text-xs text-slate-400">
              Buscá el local en Google Maps, tocá "Compartir" y pegá el link acá. Si lo cargás,
              "Cómo llegar" en la app lleva directo al pin exacto en vez de buscar por texto
              (que a veces falla con direcciones informales).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Referencia (opcional)</label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="Cerca al parque Kennedy"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Horario (opcional)</label>
              <input
                type="text"
                value={form.schedule}
                onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                placeholder="Lun-Sáb 9am-7pm"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Teléfono (opcional)</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="999 888 777"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar punto de entrega"
        message={<p>¿Eliminar este punto de entrega? Esta acción no se puede deshacer.</p>}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
