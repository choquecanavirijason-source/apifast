import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Boxes, AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "react-toastify";
import { useSearchParams } from "react-router-dom";
import DataTable, { type DataTableAction, type DataTableColumn } from "../../../components/common/table/DataTable.tsx";
import Layout from "../../../components/common/layout.tsx";
import FilterActionBar from "../../../components/common/FilterActionBar.tsx";
import GenericModal from "../../../components/common/modal/GenericModal.tsx";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button, InputField, SectionCard, StatCard } from "../../../components/common/ui/index.ts";
import { CategoryService, type CategoryItem } from "../../../core/services/category/category.service.ts";
import { BranchService } from "../../../core/services/branch/branch.service.ts";
import {
  ProductService,
  type ProductCreatePayload,
} from "../../../core/services/product/product.service.ts";
import ProductFormModal from "./ProductFormModal.tsx";
import CategoriesSection from "./CategoriesSection";
import CategoryCreateModal from "./CategoryCreateModal";

import type { Product } from "../../../core/types/IProduct.ts";


type ProductForm = Omit<Product, "id" | "updatedAt">;
type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;
type ProductSection = "products" | "categories";
interface BranchOption {
  id: number;
  name: string;
}

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  category: "",
  supplier: "",
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  description: "",
  active: true,
};

export default function Main() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "active" | "low-stock">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchProduct, setBatchProduct] = useState<Product | null>(null);
  const [batchBranchId, setBatchBranchId] = useState<string>("");
  const [batchQuantity, setBatchQuantity] = useState<string>("1");
  const [batchCostPerUnit, setBatchCostPerUnit] = useState<string>("0");
  const [batchSalePrice, setBatchSalePrice] = useState<string>("");

  const currentSection: ProductSection =
    searchParams.get("section") === "categories" ? "categories" : "products";

  const changeSection = (section: ProductSection) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("section", section);
    setSearchParams(nextParams);
  };

  const formErrors = useMemo<ProductFormErrors>(() => {
    const errors: ProductFormErrors = {};

    const normalizedName = form.name.trim();
    const normalizedSku = form.sku.trim().toUpperCase();
    const normalizedCategory = form.category.trim();
    const normalizedImageUrl = form.imageUrl?.trim() ?? "";

    if (!normalizedName) {
      errors.name = "El nombre es obligatorio.";
    } else if (normalizedName.length < 2) {
      errors.name = "El nombre debe tener al menos 2 caracteres.";
    }

    if (!normalizedSku) {
      errors.sku = "El SKU es obligatorio.";
    } else if (!/^[A-Z0-9_-]{3,30}$/.test(normalizedSku)) {
      errors.sku = "Usa 3-30 caracteres: letras, numeros, guion o guion bajo.";
    }

    if (normalizedCategory) {
      const exists = categories.some((item) => item.name.toLowerCase() === normalizedCategory.toLowerCase());
      if (!exists) {
        errors.category = "Selecciona una categoria valida.";
      }
    }

    if (form.price < 0) {
      errors.price = "El precio no puede ser negativo.";
    }

    if (form.cost < 0) {
      errors.cost = "El costo no puede ser negativo.";
    }

    if (form.stock < 0 || !Number.isInteger(form.stock)) {
      errors.stock = "El stock debe ser un entero mayor o igual a 0.";
    }

    if (form.minStock < 0 || !Number.isInteger(form.minStock)) {
      errors.minStock = "El stock minimo debe ser un entero mayor o igual a 0.";
    }

    if (normalizedImageUrl) {
      try {
        const parsed = new URL(normalizedImageUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.imageUrl = "La URL debe iniciar con http:// o https://";
        }
      } catch {
        errors.imageUrl = "Ingresa una URL valida.";
      }
    }

    if (form.description.length > 500) {
      errors.description = "La descripcion no puede superar los 500 caracteres.";
    }

    return errors;
  }, [form, categories]);

  const categoryFormError = useMemo(() => {
    const normalized = newCategory.trim();
    if (!normalized) return "El nombre de la categoria es obligatorio.";
    if (normalized.length < 2) return "El nombre debe tener al menos 2 caracteres.";
    if (normalized.length > 100) return "El nombre no puede superar los 100 caracteres.";

    const exists = categories.some((category) => category.name.toLowerCase() === normalized.toLowerCase());
    if (exists) return "La categoria ya existe.";

    return "";
  }, [newCategory, categories]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const candidate = error as { response?: { data?: { detail?: string; message?: string } } };
      return candidate.response?.data?.detail ?? candidate.response?.data?.message ?? fallback;
    }
    return fallback;
  };

  const loadCategories = async () => {
    try {
      const data = await CategoryService.listCategories();
      setCategories(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron cargar las categorias."));
    }
  };

  const loadBranches = async () => {
    try {
      const data = await BranchService.list({ skip: 0, limit: 200 });
      setBranches(data.map((branch) => ({ id: branch.id, name: branch.name })));
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron cargar las sucursales."));
      setBranches([]);
    }
  };

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const data = await ProductService.listProducts({ limit: 200 });
      setProducts(data);
    } catch (error) {
      const message = getErrorMessage(error, "No se pudieron cargar los productos.");
      setProductsError(message);
      toast.error(message);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    void loadProducts();
    void loadBranches();
  }, []);

  const totalStockUnits = useMemo(() => products.reduce((sum, product) => sum + product.stock, 0), [products]);
  const lowStockCount = useMemo(() => products.filter((product) => product.stock <= product.minStock).length, [products]);
  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, product) => sum + product.price * product.stock, 0);
  }, [products]);
  const filteredProducts = useMemo(() => {
    if (viewMode === "active") {
      return products.filter((product) => product.active);
    }
    if (viewMode === "low-stock") {
      return products.filter((product) => product.stock <= product.minStock);
    }
    return products;
  }, [products, viewMode]);

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.stock <= product.minStock).slice(0, 6),
    [products],
  );

  const openCreate = () => {
    setIsEditing(false);
    setSelectedId(null);
    setForm({ ...emptyForm, category: categories[0]?.name ?? "" });
    setIsModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setIsEditing(true);
    setSelectedId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      supplier: product.supplier,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description,
      active: product.active,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedId(null);
    setIsEditing(false);
    setForm(emptyForm);
  };

  const handleTextChange = (field: keyof ProductForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof ProductForm, value: string) => {
    const parsed = Number(value);
    setForm((prev) => ({ ...prev, [field]: Number.isNaN(parsed) ? 0 : parsed }));
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (Object.keys(formErrors).length > 0) {
      const firstError = Object.values(formErrors)[0];
      toast.warning(firstError);
      return;
    }

    const normalized: ProductForm = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim(),
      supplier: form.supplier.trim(),
      description: form.description.trim(),
      price: Math.max(0, form.price),
      cost: Math.max(0, form.cost),
      stock: Math.max(0, form.stock),
      minStock: Math.max(0, form.minStock),
    };

    if (!normalized.name || !normalized.sku) {
      toast.warning("Nombre y SKU son obligatorios.");
      return;
    }

    const category = categories.find(
      (item) => item.name.toLowerCase() === normalized.category.toLowerCase(),
    );

    if (normalized.category && !category) {
      toast.warning("Selecciona una categoria valida.");
      return;
    }

    const payload: ProductCreatePayload = {
      sku: normalized.sku,
      name: normalized.name,
      category_id: category?.id,
      price: normalized.price,
      cost: normalized.cost,
      status: normalized.active,
      image_url: normalized.imageUrl?.trim() || undefined,
      initial_stock: normalized.stock,
    };

    setIsMutating(true);
    try {
      if (isEditing && selectedId !== null) {
        await ProductService.updateProduct(selectedId, payload);
        toast.success("Producto actualizado correctamente.");
      } else {
        await ProductService.createProduct(payload);
        toast.success("Producto creado correctamente.");
      }

      closeModal();
      await loadProducts();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo guardar el producto."));
    } finally {
      setIsMutating(false);
    }
  };

  const requestDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setIsMutating(true);
    try {
      await ProductService.removeProduct(productToDelete.id);
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
      toast.success("Producto eliminado correctamente.");
      await loadProducts();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el producto."));
    } finally {
      setIsMutating(false);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = newCategory.trim();
    if (categoryFormError) {
      toast.warning(categoryFormError);
      return;
    }

    setIsMutating(true);
    try {
      const created = await CategoryService.createCategory({ name: normalized });
      setCategories((prev) => [...prev, created]);
      setNewCategory("");
      setIsCategoryModalOpen(false);
      toast.success("Categoria agregada correctamente.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo crear la categoria."));
    } finally {
      setIsMutating(false);
    }
  };

  const removeCategory = async (category: CategoryItem) => {
    const inUse = products.some((product) => product.category.toLowerCase() === category.name.toLowerCase());
    if (inUse) {
      toast.error("No puedes eliminar una categoria asignada a productos.");
      return;
    }

    setIsMutating(true);
    try {
      await CategoryService.removeCategory(category.id);
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
      toast.success("Categoria eliminada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar la categoria."));
    } finally {
      setIsMutating(false);
    }
  };

  const openBatchModal = (product: Product) => {
    setBatchProduct(product);
    setBatchBranchId(branches[0]?.id ? String(branches[0].id) : "");
    setBatchQuantity("1");
    setBatchCostPerUnit(String(product.cost || 0));
    setBatchSalePrice(String(product.price || 0));
    setIsBatchModalOpen(true);
  };

  const closeBatchModal = () => {
    if (isMutating) return;
    setIsBatchModalOpen(false);
    setBatchProduct(null);
    setBatchBranchId("");
    setBatchQuantity("1");
    setBatchCostPerUnit("0");
    setBatchSalePrice("");
  };

  const submitNewBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!batchProduct) return;

    const parsedBranchId = Number(batchBranchId);
    const parsedQuantity = Number(batchQuantity);
    const parsedCost = Number(batchCostPerUnit);
    const parsedSalePrice = batchSalePrice.trim() ? Number(batchSalePrice) : undefined;

    if (!Number.isFinite(parsedBranchId) || parsedBranchId <= 0) {
      toast.warning("Selecciona una sucursal valida.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.warning("La cantidad del lote debe ser mayor a 0.");
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.warning("El costo por unidad no puede ser negativo.");
      return;
    }
    if (parsedSalePrice !== undefined && (!Number.isFinite(parsedSalePrice) || parsedSalePrice < 0)) {
      toast.warning("El precio de venta del lote no puede ser negativo.");
      return;
    }

    setIsMutating(true);
    try {
      await ProductService.createBatch({
        product_id: batchProduct.id,
        branch_id: parsedBranchId,
        quantity: parsedQuantity,
        cost_per_unit: parsedCost,
        sale_price_per_unit: parsedSalePrice,
      });
      toast.success("Lote registrado correctamente. El stock del producto se actualizo.");
      closeBatchModal();
      await loadProducts();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo registrar el lote."));
    } finally {
      setIsMutating(false);
    }
  };

  const columns: DataTableColumn<Product>[] = [
    {
      key: "name",
      header: "Producto",
      sortable: true,
      render: (product) => (
        <div>
          <p className="font-semibold text-slate-800">{product.name}</p>
          <p className="text-xs text-slate-500">{product.supplier || "Sin proveedor"}</p>
        </div>
      ),
      getValue: (product) => `${product.name} ${product.supplier}`,
    },
    {
      key: "sku",
      header: "SKU",
      sortable: true,
      render: (product) => <span className="font-medium text-slate-700">{product.sku}</span>,
    },
    {
      key: "category",
      header: "Categoria",
      sortable: true,
      render: (product) => <span className="text-slate-600">{product.category || "-"}</span>,
    },
    {
      key: "price",
      header: "Precio",
      sortable: true,
      render: (product) => <span className="text-slate-700">${product.price.toFixed(2)}</span>,
      getValue: (product) => product.price,
    },
    {
      key: "cost",
      header: "Costo",
      sortable: true,
      render: (product) => <span className="text-slate-700">${product.cost.toFixed(2)}</span>,
      getValue: (product) => product.cost,
    },
    {
      key: "stock",
      header: "Stock",
      sortable: true,
      render: (product) => {
        const isLowStock = product.stock <= product.minStock;
        return (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isLowStock ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {product.stock} (min. {product.minStock})
          </span>
        );
      },
      getValue: (product) => product.stock,
    },
    {
      key: "active",
      header: "Estado",
      sortable: true,
      render: (product) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            product.active ? "bg-slate-100 text-slate-700" : "bg-rose-100 text-rose-700"
          }`}
        >
          {product.active ? "Activo" : "Inactivo"}
        </span>
      ),
      getValue: (product) => (product.active ? "activo" : "inactivo"),
    },
  ];

  const actions: DataTableAction<Product>[] = [
    {
      label: "Agregar lote",
      icon: <Plus className="h-4 w-4" />,
      onClick: (product) => openBatchModal(product),
      variant: "primary",
    },
    {
      label: "Editar",
      icon: <Pencil className="h-4 w-4" />,
      onClick: (product) => openEdit(product),
    },
    {
      label: "Eliminar",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (product) => requestDeleteProduct(product),
      variant: "danger",
    },
  ];

  const categoryUsageMap = useMemo(() => {
    const usage = new Map<string, number>();
    products.forEach((product) => {
      const key = product.category.trim().toLowerCase();
      if (!key) return;
      usage.set(key, (usage.get(key) ?? 0) + 1);
    });
    return usage;
  }, [products]);

  const categoryColumns: DataTableColumn<CategoryItem>[] = [
    {
      key: "name",
      header: "Categoria",
      sortable: true,
      render: (category) => <span className="font-semibold text-slate-800">{category.name}</span>,
    },
    {
      key: "description",
      header: "Descripcion",
      sortable: true,
      render: (category) => <span className="text-slate-600">{category.description?.trim() || "-"}</span>,
    },
    {
      key: "usage",
      header: "Productos asociados",
      sortable: true,
      render: (category) => {
        const usage = categoryUsageMap.get(category.name.toLowerCase()) ?? 0;
        return <span className="text-slate-700">{usage}</span>;
      },
      getValue: (category) => categoryUsageMap.get(category.name.toLowerCase()) ?? 0,
    },
  ];

  const categoryActions: DataTableAction<CategoryItem>[] = [
    {
      label: "Eliminar",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (category) => void removeCategory(category),
      variant: "danger",
    },
  ];

  const openCategoryModal = () => {
    setNewCategory("");
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    if (isMutating) return;
    setIsCategoryModalOpen(false);
  };

  const renderToolbar = () => (
    <FilterActionBar
      left={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <Button
              variant="ghost"
              size="md"
              onClick={() => changeSection("products")}
              className={
                currentSection === "products"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }
            >
              Seccion productos
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => changeSection("categories")}
              className={
                currentSection === "categories"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }
            >
              Seccion categorias
            </Button>
          </div>

          {currentSection === "products" ? (
            <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100/80 p-1">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setViewMode("all")}
                className={
                  viewMode === "all"
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }
              >
                Todos ({products.length})
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setViewMode("active")}
                className={
                  viewMode === "active"
                    ? "bg-white text-[#094732] shadow-sm ring-1 ring-black/5"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }
              >
                Activos
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setViewMode("low-stock")}
                className={
                  viewMode === "low-stock"
                    ? "bg-white text-amber-700 shadow-sm ring-1 ring-black/5"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }
              >
                Bajo stock ({lowStockCount})
              </Button>
            </div>
          ) : null}
        </div>
      }
      right={
        currentSection === "products" ? (
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo producto
          </Button>
        ) : null
      }
    />
  );

  return (
    <>
      <Layout
        title="Productos e Inventario"
        subtitle="Administra precio, stock, costo, proveedor y estado de cada producto."
        variant="table"
        topContent={(
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Stock total"
              value={totalStockUnits}
              icon={<Boxes className="h-4 w-4" />}
              tone="slate"
            />
            <StatCard
              label="Bajo stock"
              value={lowStockCount}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="amber"
            />
            <StatCard
              label="Valor inventario"
              value={`$${totalInventoryValue.toFixed(2)}`}
              icon={<DollarSign className="h-4 w-4" />}
              tone="emerald"
            />
          </div>
        )}
        toolbar={renderToolbar()}
      >
        {currentSection === "products" && lowStockProducts.length > 0 ? (
          <SectionCard className="mb-4 border border-amber-200 bg-amber-50/70" bodyClassName="!p-3">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <p className="text-sm font-semibold text-amber-800">Productos que requieren reposicion</p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-amber-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    Stock {product.stock} / Min {product.minStock}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        {currentSection === "categories" ? (
          <CategoriesSection
            categories={categories}
            columns={categoryColumns}
            actions={categoryActions}
            isLoading={isMutating && categories.length === 0}
            onOpenCreateModal={openCategoryModal}
          />
        ) : null}

        {currentSection === "products" && productsError ? (
          <SectionCard className="mb-4 border border-rose-200 bg-rose-50" bodyClassName="!p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-rose-700">{productsError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadProducts()}>
                Reintentar
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {currentSection === "products" ? (
          <DataTable
            data={filteredProducts}
            columns={columns}
            actions={actions}
            loading={isLoadingProducts}
            defaultLimit={10}
            availableLimits={[5, 10, 20, 50]}
            globalSearchPlaceholder={
              isLoadingProducts ? "Cargando productos..." : "Buscar por nombre, SKU, categoria o proveedor"
            }
            enableColumnFilters
          />
        ) : null}
      </Layout>

      {currentSection === "products" ? (
        <ProductFormModal
          isOpen={isModalOpen}
          isEditing={isEditing}
          isSubmitting={isMutating}
          form={form}
          categories={categories}
          errors={formErrors}
          onClose={closeModal}
          onSubmit={saveProduct}
          onTextChange={handleTextChange}
          onNumberChange={handleNumberChange}
          onActiveChange={(active) => setForm((prev) => ({ ...prev, active }))}
        />
      ) : null}

      {currentSection === "categories" ? (
        <CategoryCreateModal
          isOpen={isCategoryModalOpen}
          isSubmitting={isMutating}
          categoryName={newCategory}
          errorMessage={categoryFormError || undefined}
          onClose={closeCategoryModal}
          onCategoryNameChange={setNewCategory}
          onSubmit={addCategory}
        />
      ) : null}

      <GenericModal
        isOpen={isBatchModalOpen}
        onClose={closeBatchModal}
        title={`Registrar lote${batchProduct ? ` · ${batchProduct.name}` : ""}`}
        asForm
        onSubmit={submitNewBatch}
        size="md"
      >
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-slate-600">
            Un mismo producto puede tener varios lotes con distinto costo/precio. El stock total del producto se suma automaticamente.
          </p>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Sucursal</label>
            <select
              value={batchBranchId}
              onChange={(event) => setBatchBranchId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-[#094732] focus:ring-2 focus:ring-[#094732]/20"
              required
            >
              <option value="">Seleccionar sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <InputField
            name="batch_quantity"
            type="number"
            min={0.01}
            step={0.01}
            label="Cantidad del lote"
            value={batchQuantity}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBatchQuantity(event.target.value)}
            required
          />

          <InputField
            name="batch_cost_per_unit"
            type="number"
            min={0}
            step={0.01}
            label="Costo por unidad del lote"
            value={batchCostPerUnit}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBatchCostPerUnit(event.target.value)}
            required
          />

          <InputField
            name="batch_sale_price_per_unit"
            type="number"
            min={0}
            step={0.01}
            label="Precio de venta por unidad del lote (opcional)"
            value={batchSalePrice}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setBatchSalePrice(event.target.value)}
            hint="Si lo completas, actualizara el precio de venta actual del producto."
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeBatchModal} disabled={isMutating}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isMutating}>
            {isMutating ? "Guardando..." : "Registrar lote"}
          </Button>
        </div>
      </GenericModal>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title="Eliminar producto"
        message={
          <p>
            ¿Seguro que deseas eliminar <strong>{productToDelete?.name}</strong>? Esta accion no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isProcessing={isMutating}
        onConfirm={() => void confirmDeleteProduct()}
        onCancel={() => {
          if (isMutating) return;
          setIsDeleteConfirmOpen(false);
          setProductToDelete(null);
        }}
      />
    </>
  );
}
