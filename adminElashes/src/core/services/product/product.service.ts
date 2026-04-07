import api from "../api";
import type { Product } from "../../types/IProduct";

interface BackendCategory {
  id: number;
  name: string;
  description?: string | null;
}

interface BackendProductCategory {
  id: number;
  name: string;
}

interface BackendProduct {
  id: number;
  sku: string;
  name: string;
  category_id?: number | null;
  price: number;
  cost: number;
  status: boolean;
  image_url?: string | null;
  supplier?: string | null;
  description?: string | null;
  min_stock?: number | null;
  updated_at?: string | null;
  category?: BackendProductCategory | null;
}

interface BackendStockSummary {
  product_id: number;
  product_name: string;
  product_sku: string;
  branch_id: number;
  branch_name: string;
  total_stock: number;
}

interface MessageResponse {
  message: string;
}

interface BackendBatch {
  id: number;
  product_id: number;
  branch_id: number;
  initial_quantity: number;
  current_quantity: number;
  cost_per_unit: number;
  sale_price_per_unit?: number | null;
  entry_date: string;
}

export interface ProductCategoryOption {
  id: number;
  name: string;
  description?: string | null;
}

export interface ProductCreatePayload {
  sku: string;
  name: string;
  category_id?: number;
  price: number;
  cost: number;
  status: boolean;
  image_url?: string;
  initial_stock?: number;
  branch_id?: number;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload>;

export interface ProductBatchCreatePayload {
  product_id: number;
  branch_id: number;
  quantity: number;
  cost_per_unit: number;
  sale_price_per_unit?: number;
}

const mapBackendProductToProduct = (product: BackendProduct, stock: number): Product => ({
  id: product.id,
  name: product.name?.trim() ?? "",
  sku: product.sku?.trim() ?? "",
  category: product.category?.name ?? "",
  categoryId: product.category_id ?? undefined,
  supplier: product.supplier?.trim() ?? "",
  price: Number(product.price ?? 0),
  cost: Number(product.cost ?? 0),
  stock: Number.isFinite(stock) ? Math.max(0, Number(stock)) : 0,
  minStock: Number.isFinite(product.min_stock) ? Math.max(0, Number(product.min_stock)) : 0,
  description: product.description?.trim() ?? "",
  active: Boolean(product.status),
  imageUrl: product.image_url ?? undefined,
  updatedAt: product.updated_at ?? "",
});

const buildStockMap = (rows: BackendStockSummary[]) => {
  const map = new Map<number, number>();
  rows.forEach((row) => {
    const previous = map.get(row.product_id) ?? 0;
    map.set(row.product_id, previous + Number(row.total_stock ?? 0));
  });
  return map;
};

export const ProductService = {
  async listCategories(): Promise<ProductCategoryOption[]> {
    const response = await api.get<BackendCategory[]>("/inventory/categories");
    return response.data.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
    }));
  },

  async createCategory(payload: { name: string; description?: string }): Promise<ProductCategoryOption> {
    const response = await api.post<BackendCategory>("/inventory/categories", payload);
    return {
      id: response.data.id,
      name: response.data.name,
      description: response.data.description,
    };
  },

  async removeCategory(id: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/inventory/categories/${id}`);
    return response.data;
  },

  async listProducts(params?: { skip?: number; limit?: number; category_id?: number; active_only?: boolean }): Promise<Product[]> {
    const [productsResponse, stockResponse] = await Promise.all([
      api.get<BackendProduct[]>("/inventory/products", { params }),
      api.get<BackendStockSummary[]>("/inventory/stock-summary"),
    ]);

    const stockMap = buildStockMap(stockResponse.data);

    return productsResponse.data.map((product) =>
      mapBackendProductToProduct(product, stockMap.get(product.id) ?? 0),
    );
  },

  async createProduct(payload: ProductCreatePayload): Promise<Product> {
    const response = await api.post<BackendProduct>("/inventory/products", payload);
    return mapBackendProductToProduct(response.data, 0);
  },

  async updateProduct(id: number, payload: ProductUpdatePayload): Promise<Product> {
    const response = await api.put<BackendProduct>(`/inventory/products/${id}`, payload);
    return mapBackendProductToProduct(response.data, 0);
  },

  async removeProduct(id: number): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/inventory/products/${id}`);
    return response.data;
  },

  async createBatch(payload: ProductBatchCreatePayload) {
    const response = await api.post<BackendBatch>("/inventory/batches", payload);
    return response.data;
  },
};
