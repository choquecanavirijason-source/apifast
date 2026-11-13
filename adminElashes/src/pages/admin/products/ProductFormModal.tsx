import { useRef, useState } from "react";
import type { DragEvent, FormEvent, ReactNode } from "react";
import { ImagePlus, Loader2, Package, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import GenericModal from "../../../components/common/modal/GenericModal.tsx";
import { Button, InputField } from "../../../components/common/ui/index.ts";
import type { Product } from "../../../core/types/IProduct.ts";
import type { ProductCategoryOption } from "../../../core/services/product/product.service.ts";

type ProductForm = Omit<Product, "id" | "updatedAt">;
type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface ProductFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  form: ProductForm;
  errors: ProductFormErrors;
  /** Error de sucursal al crear (no es un campo del formulario): se muestra arriba. */
  branchError?: string;
  /** Nombre de la sucursal donde se registrará el stock inicial. */
  branchName?: string;
  categories: ProductCategoryOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onTextChange: (field: keyof ProductForm, value: string) => void;
  onNumberChange: (field: keyof ProductForm, value: string) => void;
  onActiveChange: (active: boolean) => void;
  /** Sube la foto elegida y devuelve su URL. Si no se pasa, solo se puede pegar un enlace. */
  onUploadImage?: (file: File) => Promise<string>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

const money = (value: number) => `Bs ${value.toFixed(2)}`;

export default function ProductFormModal({
  isOpen,
  isEditing,
  isSubmitting,
  form,
  errors,
  branchError,
  branchName,
  categories,
  onClose,
  onSubmit,
  onTextChange,
  onNumberChange,
  onActiveChange,
  onUploadImage,
}: ProductFormModalProps) {
  const hasValidationErrors = Object.keys(errors).length > 0 || Boolean(branchError);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const profit = form.price - form.cost;
  const profitPct = form.price > 0 ? (profit / form.price) * 100 : 0;

  const uploadFile = async (file: File | undefined | null) => {
    if (!file || !onUploadImage) return;
    if (!file.type.startsWith("image/")) {
      toast.warning("Elige un archivo de imagen (JPG, PNG o WEBP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.warning("La imagen supera los 5 MB. Elige una más liviana.");
      return;
    }
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setImageFailed(false);
      onTextChange("imageUrl", url);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || "No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void uploadFile(event.dataTransfer.files?.[0]);
  };

  const hasImage = Boolean(form.imageUrl?.trim()) && !imageFailed;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar producto" : "Nuevo producto"}
      asForm
      onSubmit={onSubmit}
      size="xl"
    >
      {branchError ? (
        <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {branchError}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[230px_1fr]">
          {/* Imagen */}
          <Section title="Imagen" hint="Se ve en la caja al vender.">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void uploadFile(event.target.files?.[0])}
            />
            <div
              onDragOver={(event) => {
                if (!onUploadImage) return;
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                dragOver ? "border-[#094732] bg-[#ecfdf5]" : "border-slate-300 bg-slate-50"
              }`}
            >
              {hasImage ? (
                <img
                  src={form.imageUrl}
                  alt="Vista previa del producto"
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <button
                  type="button"
                  disabled={!onUploadImage || uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-slate-400 transition hover:text-[#094732] disabled:cursor-not-allowed"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-xs font-semibold">{imageFailed ? "No se pudo cargar la imagen" : "Subir imagen"}</span>
                  <span className="text-[11px]">Haz clic o arrastra una foto aquí</span>
                </button>
              )}
              {uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="h-6 w-6 animate-spin text-[#094732]" />
                </div>
              ) : null}
            </div>

            {onUploadImage ? (
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {hasImage ? "Cambiar" : "Elegir foto"}
                </Button>
                {hasImage || form.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setImageFailed(false);
                      onTextChange("imageUrl", "");
                    }}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-[11px] text-slate-400">JPG, PNG o WEBP, máximo 5 MB.</p>

            <details className="mt-3 text-xs text-slate-500" open={Boolean(errors.imageUrl)}>
              <summary className="cursor-pointer font-medium text-slate-600">O pegar un enlace</summary>
              <div className="mt-2">
                <InputField
                  name="imageUrl"
                  type="url"
                  placeholder="https://..."
                  value={form.imageUrl ?? ""}
                  onChange={(event) => {
                    setImageFailed(false);
                    onTextChange("imageUrl", event.target.value);
                  }}
                  error={errors.imageUrl}
                />
              </div>
            </details>
          </Section>

          {/* Datos básicos */}
          <Section title="Datos del producto">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                name="name"
                label="Nombre del producto"
                value={form.name}
                onChange={(event) => onTextChange("name", event.target.value)}
                error={errors.name}
                containerClassName="sm:col-span-2"
                required
              />
              <InputField
                name="sku"
                label="SKU (código)"
                value={form.sku}
                onChange={(event) => onTextChange("sku", event.target.value)}
                error={errors.sku}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700" htmlFor="product-category">
                  Categoría{!isEditing ? <span className="text-rose-600"> *</span> : null}
                </label>
                <select
                  id="product-category"
                  name="category"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
                  value={form.category}
                  onChange={(event) => onTextChange("category", event.target.value)}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.category ? <p className="text-xs font-medium text-rose-600">{errors.category}</p> : null}
              </div>
              <InputField
                name="supplier"
                label="Proveedor (opcional)"
                value={form.supplier}
                onChange={(event) => onTextChange("supplier", event.target.value)}
                containerClassName="sm:col-span-2"
              />
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Precios */}
          <Section title="Precios">
            <div className="grid grid-cols-2 gap-4">
              <InputField
                name="price"
                type="number"
                min={0}
                step={0.01}
                label="Precio de venta (Bs)"
                value={String(form.price)}
                onChange={(event) => onNumberChange("price", event.target.value)}
                error={errors.price}
                required={!isEditing}
              />
              <InputField
                name="cost"
                type="number"
                min={0}
                step={0.01}
                label="Costo (Bs)"
                value={String(form.cost)}
                onChange={(event) => onNumberChange("cost", event.target.value)}
                error={errors.cost}
              />
            </div>
            {form.price > 0 ? (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${profit >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                Ganancia por unidad: <strong>{money(profit)}</strong> ({profitPct.toFixed(0)}%)
                {profit < 0 ? " — el costo es mayor que el precio." : ""}
              </p>
            ) : null}
          </Section>

          {/* Inventario */}
          <Section
            title="Inventario"
            hint={
              isEditing
                ? "El stock real se ajusta con lotes y movimientos de inventario."
                : branchName
                  ? `Se registra en la sucursal ${branchName}.`
                  : "Se registra en la sucursal elegida arriba."
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <InputField
                name="stock"
                type="number"
                min={0}
                step={1}
                label={isEditing ? "Stock actual" : "Stock inicial"}
                value={String(form.stock)}
                // Al editar es el stock real y no se modifica desde aquí.
                readOnly={isEditing}
                tabIndex={isEditing ? -1 : undefined}
                className={isEditing ? "cursor-not-allowed !bg-slate-100 text-slate-500 focus:!ring-0" : ""}
                onChange={(event) => onNumberChange("stock", event.target.value)}
                error={errors.stock}
              />
              <InputField
                name="minStock"
                type="number"
                min={0}
                step={1}
                label="Stock mínimo"
                value={String(form.minStock)}
                onChange={(event) => onNumberChange("minStock", event.target.value)}
                error={errors.minStock}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {isEditing
                ? "El stock mínimo es solo una alerta de reposición en esta vista."
                : "Con stock 0 el producto aparece como agotado en la caja hasta que registres stock. El mínimo es solo una alerta de reposición."}
            </p>
          </Section>
        </div>

        {/* Descripción y estado */}
        <Section title="Descripción y estado">
          <textarea
            id="product-description"
            aria-label="Descripción"
            placeholder="Descripción del producto (opcional)"
            className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            rows={3}
            value={form.description}
            onChange={(event) => onTextChange("description", event.target.value)}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            {errors.description ? <p className="text-xs font-medium text-rose-600">{errors.description}</p> : <span />}
            <p className="text-xs text-slate-500">{form.description.length}/500</p>
          </div>

          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium text-slate-700">Producto activo para venta</span>
              <span className="block text-xs text-slate-400">Si lo desactivas, deja de aparecer en la caja.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={form.active}
              onChange={(event) => onActiveChange(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#094732]"
            />
          </label>
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          leftIcon={<Package className="h-4 w-4" />}
          disabled={isSubmitting || uploading || hasValidationErrors}
        >
          {isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </GenericModal>
  );
}
