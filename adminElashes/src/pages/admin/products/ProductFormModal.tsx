import type { FormEvent } from "react";
import { Package } from "lucide-react";
import GenericModal from "../../../components/common/modal/GenericModal.tsx";
import { Button, InputField } from "../../../components/common/ui/index.ts";
import type { Product } from "../../../core/types/IProduct.ts";
import type { ProductCategoryOption } from "../../../core/services/product/product.service.ts";

type ProductForm = Omit<Product, "id" | "updatedAt">;
type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

interface ProductFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  form: ProductForm;
  errors: ProductFormErrors;
  categories: ProductCategoryOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onTextChange: (field: keyof ProductForm, value: string) => void;
  onNumberChange: (field: keyof ProductForm, value: string) => void;
  onActiveChange: (active: boolean) => void;
}

export default function ProductFormModal({
  isOpen,
  isEditing,
  isSubmitting,
  form,
  errors,
  categories,
  onClose,
  onSubmit,
  onTextChange,
  onNumberChange,
  onActiveChange,
}: ProductFormModalProps) {
  const hasValidationErrors = Object.keys(errors).length > 0;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar producto" : "Nuevo producto"}
      asForm
      onSubmit={onSubmit}
      size="xl"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField
          name="name"
          label="Nombre del producto"
          value={form.name}
          onChange={(event) => onTextChange("name", event.target.value)}
          error={errors.name}
          required
        />
        <InputField
          name="sku"
          label="SKU"
          value={form.sku}
          onChange={(event) => onTextChange("sku", event.target.value)}
          error={errors.sku}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="product-category">
            Categoria
          </label>
          <select
            id="product-category"
            name="category"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            value={form.category}
            onChange={(event) => onTextChange("category", event.target.value)}
          >
            <option value="">Seleccionar categoria</option>
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
          label="Proveedor"
          value={form.supplier}
          onChange={(event) => onTextChange("supplier", event.target.value)}
        />

        <InputField
          name="imageUrl"
          type="url"
          label="Imagen (URL)"
          placeholder="https://..."
          value={form.imageUrl ?? ""}
          onChange={(event) => onTextChange("imageUrl", event.target.value)}
          error={errors.imageUrl}
        />

        <InputField
          name="price"
          type="number"
          min={0}
          step={0.01}
          label="Precio de venta"
          value={String(form.price)}
          onChange={(event) => onNumberChange("price", event.target.value)}
          error={errors.price}
        />

        <InputField
          name="cost"
          type="number"
          min={0}
          step={0.01}
          label="Costo"
          value={String(form.cost)}
          onChange={(event) => onNumberChange("cost", event.target.value)}
          error={errors.cost}
        />

        <InputField
          name="stock"
          type="number"
          min={0}
          step={1}
          label="Stock actual (solo visual)"
          value={String(form.stock)}
          onChange={(event) => onNumberChange("stock", event.target.value)}
          hint={errors.stock ? undefined : "El stock final se calcula con lotes y movimientos de inventario."}
          error={errors.stock}
        />

        <InputField
          name="minStock"
          type="number"
          min={0}
          step={1}
          label="Stock minimo (solo visual)"
          value={String(form.minStock)}
          onChange={(event) => onNumberChange("minStock", event.target.value)}
          hint={errors.minStock ? undefined : "Usado para alertas de reposicion en esta vista."}
          error={errors.minStock}
        />

        <div className="md:col-span-2 space-y-1.5">
          <label className="block text-sm font-medium text-slate-700" htmlFor="product-description">
            Descripcion
          </label>
          <textarea
            id="product-description"
            className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
            rows={3}
            value={form.description}
            onChange={(event) => onTextChange("description", event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            {errors.description ? <p className="text-xs font-medium text-rose-600">{errors.description}</p> : <span />}
            <p className="text-xs text-slate-500">{form.description.length}/500</p>
          </div>
        </div>

        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => onActiveChange(event.target.checked)}
          />
          Producto activo para venta
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          leftIcon={<Package className="h-4 w-4" />}
          disabled={isSubmitting || hasValidationErrors}
        >
          {isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </GenericModal>
  );
}
