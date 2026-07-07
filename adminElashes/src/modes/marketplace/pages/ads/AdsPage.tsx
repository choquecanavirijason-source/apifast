import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Megaphone, Plus, Pencil, Trash2, Upload, Eye, EyeOff, ImageIcon,
  ArrowUp, ArrowDown, ExternalLink,
} from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, InputField, StatCard } from "@/components/common/ui";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  fetchAdminAds,
  createAd,
  updateAd,
  deleteAd,
  fetchAdminProducts,
  fetchAdminCollections,
  fetchAdminCategories,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceAd,
  type AdLinkType,
  type MarketplaceProduct,
  type MarketplaceCollection,
  type MarketplaceCategory,
} from "@/core/services/marketplace/marketplace.service";

// ── helpers ───────────────────────────────────────────────────────────────────

type Form = {
  title: string;
  subtitle: string;
  cta_label: string;
  link_type: AdLinkType;
  link_value: string;
  sort_order: number;
};

const emptyForm: Form = {
  title: "",
  subtitle: "",
  cta_label: "Ver más",
  link_type: "none",
  link_value: "",
  sort_order: 0,
};

const LINK_TYPE_LABELS: Record<AdLinkType, string> = {
  none: "Ninguno (solo imagen)",
  product: "Producto",
  collection: "Colección",
  category: "Categoría",
  url: "Enlace externo (URL)",
  booking: "Abrir reservar cita",
  pickup: "Abrir puntos de recojo",
  catalog: "Abrir catálogo",
};

function img(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const [ads, setAds] = useState<MarketplaceAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [collections, setCollections] = useState<MarketplaceCollection[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<MarketplaceAd | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [reordering, setReordering] = useState<number | null>(null);

  // ── data ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      setAds(await fetchAdminAds());
    } catch {
      toast.error("No se pudieron cargar los banners de publicidad");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    fetchAdminProducts(false).then(setProducts).catch(() => {});
    fetchAdminCollections().then(setCollections).catch(() => {});
    fetchAdminCategories().then(setCategories).catch(() => {});
  }, []);

  // ── form ─────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setFormOpen(true);
  };

  const openEdit = (a: MarketplaceAd) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      subtitle: a.subtitle ?? "",
      cta_label: a.cta_label,
      link_type: a.link_type,
      link_value: a.link_value ?? "",
      sort_order: a.sort_order,
    });
    setImageFile(null);
    setImagePreview(img(a.image_url));
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    if (editingId === null && !imageFile) {
      toast.error("La imagen del banner es obligatoria");
      return;
    }
    if (form.link_type !== "none" && !["booking", "pickup", "catalog"].includes(form.link_type) && !form.link_value.trim()) {
      toast.error("Selecciona el destino del banner");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, image: imageFile ?? undefined };
      if (editingId !== null) {
        const updated = await updateAd(editingId, payload);
        setAds((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
        toast.success("Banner actualizado");
      } else {
        const created = await createAd(payload);
        setAds((prev) => [...prev, created]);
        toast.success("Banner creado");
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── toggle / delete ──────────────────────────────────────────────────────────

  const handleToggle = async (a: MarketplaceAd) => {
    setToggling(a.id);
    try {
      const updated = await updateAd(a.id, { is_active: !a.is_active });
      setAds((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } catch {
      toast.error("No se pudo cambiar el estado");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAd(deleteTarget.id);
      setAds((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Banner eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleMove = async (a: MarketplaceAd, direction: -1 | 1) => {
    const sorted = [...ads].sort((x, y) => x.sort_order - y.sort_order || x.id - y.id);
    const idx = sorted.findIndex((x) => x.id === a.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    setReordering(a.id);
    try {
      const [u1, u2] = await Promise.all([
        updateAd(a.id, { sort_order: other.sort_order }),
        updateAd(other.id, { sort_order: a.sort_order }),
      ]);
      setAds((prev) => prev.map((x) => (x.id === u1.id ? u1 : x.id === u2.id ? u2 : x)));
    } catch {
      toast.error("No se pudo reordenar");
    } finally {
      setReordering(null);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const sortedAds = [...ads].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const activeCount = ads.filter((a) => a.is_active).length;
  const needsPicker = form.link_type === "product" || form.link_type === "collection" || form.link_type === "category";
  const needsUrl = form.link_type === "url";

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Megaphone className="h-4 w-4" />
          <span>
            <strong className="text-slate-800">{ads.length}</strong> banners —{" "}
            <strong className="text-slate-800">{activeCount}</strong> activos
          </span>
        </div>
      }
      right={
        <Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>
          Nuevo banner
        </Button>
      }
    />
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Layout
        title="Publicidad"
        subtitle="Banners promocionales del carrusel en la pantalla de inicio de la app."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total banners" value={ads.length} icon={<Megaphone className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activos" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-video bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedAds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Megaphone className="h-12 w-12 mb-3 text-slate-200" />
            <p className="font-medium">Sin banners de publicidad</p>
            <p className="text-sm mt-1">Crea el primer banner con el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAds.map((a, i) => {
              const cover = img(a.image_url);
              return (
                <div key={a.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow duration-200">
                  <div className="relative aspect-video bg-slate-100 overflow-hidden">
                    {cover ? (
                      <img src={cover} alt={a.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-slate-200" />
                      </div>
                    )}
                    <button
                      onClick={() => void handleToggle(a)}
                      disabled={toggling === a.id}
                      className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm transition ${
                        a.is_active ? "bg-emerald-500/90 text-white hover:bg-emerald-600" : "bg-slate-800/70 text-white hover:bg-slate-900"
                      }`}
                    >
                      {a.is_active ? <><Eye className="h-3 w-3" /> Activo</> : <><EyeOff className="h-3 w-3" /> Inactivo</>}
                    </button>
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      #{i + 1}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 p-4">
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-snug">{a.title}</p>
                      {a.subtitle && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{a.subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-brand font-medium">
                      <ExternalLink className="h-3 w-3" />
                      {LINK_TYPE_LABELS[a.link_type]}
                    </div>

                    <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => void handleMove(a, -1)}
                        disabled={i === 0 || reordering !== null}
                        className="flex items-center justify-center rounded-xl bg-slate-100 px-2.5 py-2 text-slate-600 hover:bg-slate-200 transition disabled:opacity-40"
                        title="Subir"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void handleMove(a, 1)}
                        disabled={i === sortedAds.length - 1 || reordering !== null}
                        className="flex items-center justify-center rounded-xl bg-slate-100 px-2.5 py-2 text-slate-600 hover:bg-slate-200 transition disabled:opacity-40"
                        title="Bajar"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand/10 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => setDeleteTarget(a)}
                        className="flex items-center justify-center rounded-xl bg-rose-50 px-3 py-2 text-rose-500 hover:bg-rose-100 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Layout>

      {/* ── Modal crear / editar ─────────────────────────────────────────────── */}
      <GenericModal
        isOpen={formOpen}
        onClose={closeForm}
        title={editingId ? "Editar banner" : "Nuevo banner"}
        size="sm"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear banner"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              className="h-32 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <Upload className="h-7 w-7" />
                  <span className="text-xs">Imagen del banner (16:9 recomendado)</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-brand hover:underline">
              {imagePreview ? "Cambiar imagen" : "Subir imagen"}
            </button>
          </div>

          <InputField
            label="Título *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ej: Reserva tu cita"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Subtítulo</label>
            <textarea
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              rows={2}
              placeholder="Texto breve debajo del título…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none resize-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <InputField
            label="Texto del botón"
            value={form.cta_label}
            onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
            placeholder="Ver más"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Al tocar el banner…</label>
            <select
              value={form.link_type}
              onChange={(e) => setForm((f) => ({ ...f, link_type: e.target.value as AdLinkType, link_value: "" }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              {(Object.keys(LINK_TYPE_LABELS) as AdLinkType[]).map((k) => (
                <option key={k} value={k}>{LINK_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {needsUrl && (
            <InputField
              label="URL *"
              value={form.link_value}
              onChange={(e) => setForm((f) => ({ ...f, link_value: e.target.value }))}
              placeholder="https://…"
            />
          )}

          {form.link_type === "product" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Producto *</label>
              <select
                value={form.link_value}
                onChange={(e) => setForm((f) => ({ ...f, link_value: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Selecciona un producto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.link_type === "collection" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Colección *</label>
              <select
                value={form.link_value}
                onChange={(e) => setForm((f) => ({ ...f, link_value: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Selecciona una colección…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.link_type === "category" && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-brand-tertiary">Categoría *</label>
              <select
                value={form.link_value}
                onChange={(e) => setForm((f) => ({ ...f, link_value: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Selecciona una categoría…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {needsPicker && (
            <p className="text-xs text-slate-400">
              El destino elegido se abrirá dentro de la app al tocar el banner.
            </p>
          )}
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar banner"
        message={<p>¿Eliminar el banner <strong>{deleteTarget?.title}</strong>? Esta acción no se puede deshacer.</p>}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
