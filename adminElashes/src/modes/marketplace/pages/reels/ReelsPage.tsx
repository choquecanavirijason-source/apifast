import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Clapperboard, Plus, Pencil, Trash2, Upload, Eye, EyeOff, Video,
  ArrowUp, ArrowDown, ShoppingBag, X,
} from "lucide-react";

import Layout from "@/components/common/layout";
import FilterActionBar from "@/components/common/FilterActionBar";
import GenericModal from "@/components/common/modal/GenericModal";
import { Button, StatCard } from "@/components/common/ui";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import {
  fetchAdminReels,
  createReel,
  updateReel,
  deleteReel,
  fetchAdminProducts,
  MARKETPLACE_MEDIA_BASE,
  type MarketplaceReel,
  type MarketplaceProduct,
} from "@/core/services/marketplace/marketplace.service";

// ── helpers ───────────────────────────────────────────────────────────────────

type Form = {
  caption: string;
  video_url: string;
  product_id: string;
  sort_order: number;
};

const emptyForm: Form = {
  caption: "",
  video_url: "",
  product_id: "",
  sort_order: 0,
};

function img(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${MARKETPLACE_MEDIA_BASE}${url}`;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ReelsPage() {
  const [reels, setReels] = useState<MarketplaceReel[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<MarketplaceReel | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [reordering, setReordering] = useState<number | null>(null);

  // ── data ────────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      setReels(await fetchAdminReels());
    } catch {
      toast.error("No se pudieron cargar los reels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    fetchAdminProducts(false).then(setProducts).catch(() => {});
  }, []);

  // ── form ─────────────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setVideoFile(null);
    setThumbFile(null);
    setThumbPreview(null);
    setFormOpen(true);
  };

  const openEdit = (r: MarketplaceReel) => {
    setEditingId(r.id);
    setForm({
      caption: r.caption ?? "",
      video_url: r.video_url.startsWith("http") && !r.video_url.includes("/media/")
        ? r.video_url
        : "",
      product_id: r.product_id ? String(r.product_id) : "",
      sort_order: r.sort_order,
    });
    setVideoFile(null);
    setThumbFile(null);
    setThumbPreview(img(r.thumbnail_url));
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setVideoFile(null);
    setThumbFile(null);
    setThumbPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null && !videoFile && !form.video_url.trim()) {
      toast.error("Sube un video o pega un link directo (mp4, etc.)");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        caption: form.caption.trim() || undefined,
        video_url: form.video_url.trim() || undefined,
        product_id: form.product_id ? Number(form.product_id) : undefined,
        sort_order: Number(form.sort_order) || 0,
        video: videoFile ?? undefined,
        thumbnail: thumbFile ?? undefined,
      };
      if (editingId !== null) {
        const updated = await updateReel(editingId, payload);
        setReels((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
        toast.success("Reel actualizado");
      } else {
        const created = await createReel(payload);
        setReels((prev) => [...prev, created]);
        toast.success("Reel creado");
      }
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── toggle / delete / reorder ─────────────────────────────────────────────────

  const handleToggle = async (r: MarketplaceReel) => {
    setToggling(r.id);
    try {
      const updated = await updateReel(r.id, { is_active: !r.is_active });
      setReels((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch {
      toast.error("No se pudo cambiar el estado");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReel(deleteTarget.id);
      setReels((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Reel eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleMove = async (r: MarketplaceReel, direction: -1 | 1) => {
    const sorted = [...reels].sort((x, y) => x.sort_order - y.sort_order || x.id - y.id);
    const idx = sorted.findIndex((x) => x.id === r.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    setReordering(r.id);
    try {
      const [u1, u2] = await Promise.all([
        updateReel(r.id, { sort_order: other.sort_order }),
        updateReel(other.id, { sort_order: r.sort_order }),
      ]);
      setReels((prev) => prev.map((x) => (x.id === u1.id ? u1 : x.id === u2.id ? u2 : x)));
    } catch {
      toast.error("No se pudo reordenar");
    } finally {
      setReordering(null);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const sortedReels = [...reels].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const activeCount = reels.filter((r) => r.is_active).length;

  const toolbar = (
    <FilterActionBar
      left={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clapperboard className="h-4 w-4" />
          <span>
            <strong className="text-slate-800">{reels.length}</strong> reels —{" "}
            <strong className="text-slate-800">{activeCount}</strong> activos
          </span>
        </div>
      }
      right={
        <Button onClick={openNew} leftIcon={<Plus className="h-4 w-4" />}>
          Nuevo reel
        </Button>
      }
    />
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Layout
        title="Reels"
        subtitle="Videos cortos de aplicación de productos para la pantalla de reels de la app."
        variant="table"
        toolbar={toolbar}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Total reels" value={reels.length} icon={<Clapperboard className="h-4 w-4" />} tone="slate" />
          <StatCard label="Activos" value={activeCount} icon={<Eye className="h-4 w-4" />} tone="primary" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-pulse">
                <div className="aspect-[9/16] bg-slate-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedReels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Clapperboard className="h-12 w-12 mb-3 text-slate-200" />
            <p className="font-medium">Sin reels todavía</p>
            <p className="text-sm mt-1">Crea el primero con el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedReels.map((r, i) => {
              const cover = img(r.thumbnail_url);
              return (
                <div key={r.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow duration-200">
                  <div className="relative aspect-[9/16] bg-slate-900 overflow-hidden">
                    {cover ? (
                      <img src={cover} alt={r.caption ?? "reel"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Video className="h-10 w-10 text-white/30" />
                      </div>
                    )}
                    <button
                      onClick={() => void handleToggle(r)}
                      disabled={toggling === r.id}
                      className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm transition ${
                        r.is_active ? "bg-emerald-500/90 text-white hover:bg-emerald-600" : "bg-slate-800/70 text-white hover:bg-slate-900"
                      }`}
                    >
                      {r.is_active ? <><Eye className="h-3 w-3" /> Activo</> : <><EyeOff className="h-3 w-3" /> Inactivo</>}
                    </button>
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      #{i + 1}
                    </div>
                    {r.product && (
                      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                        <ShoppingBag className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.product.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 p-4">
                    <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                      {r.caption || <span className="italic text-slate-400">Sin descripción</span>}
                    </p>

                    <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => void handleMove(r, -1)}
                        disabled={i === 0 || reordering !== null}
                        className="flex items-center justify-center rounded-xl bg-slate-100 px-2.5 py-2 text-slate-600 hover:bg-slate-200 transition disabled:opacity-40"
                        title="Subir"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void handleMove(r, 1)}
                        disabled={i === sortedReels.length - 1 || reordering !== null}
                        className="flex items-center justify-center rounded-xl bg-slate-100 px-2.5 py-2 text-slate-600 hover:bg-slate-200 transition disabled:opacity-40"
                        title="Bajar"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand/10 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r)}
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
        title={editingId ? "Editar reel" : "Nuevo reel"}
        size="sm"
        asForm
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear reel"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Video */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">
              Video (archivo mp4/mov/webm — máx. 80 MB)
            </label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
              className="hidden"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            {videoFile ? (
              <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2">
                <Video className="h-4 w-4 text-brand shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm text-slate-700">{videoFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ""; }}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-3 text-sm text-slate-500 hover:border-brand hover:text-brand transition"
              >
                <Upload className="h-4 w-4" /> Subir archivo de video
              </button>
            )}
          </div>

          <div className="relative flex items-center gap-2 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> o <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Link directo de video</label>
            <input
              type="url"
              value={form.video_url}
              onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
              placeholder="https://ejemplo.com/video.mp4"
              disabled={!!videoFile}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Miniatura (portada, opcional)</label>
            <div className="flex items-center gap-3">
              <div
                onClick={() => thumbInputRef.current?.click()}
                className="h-20 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-brand transition"
              >
                {thumbPreview ? (
                  <img src={thumbPreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setThumbFile(f);
                  setThumbPreview(URL.createObjectURL(f));
                }}
              />
              <button type="button" onClick={() => thumbInputRef.current?.click()} className="text-xs text-brand hover:underline">
                {thumbPreview ? "Cambiar" : "Subir miniatura"}
              </button>
            </div>
          </div>

          {/* Producto ligado */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Producto (opcional)</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Ninguno</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              Si eliges un producto, en la app aparecerá un botón "Ver producto" sobre el video.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-brand-tertiary">Descripción</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              rows={2}
              placeholder="Texto breve sobre el video…"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none resize-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar reel"
        message={<p>¿Eliminar este reel? Esta acción no se puede deshacer.</p>}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
