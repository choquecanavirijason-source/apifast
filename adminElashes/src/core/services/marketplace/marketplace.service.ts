import api from "../api";

// Todas las llamadas al marketplace van a través de elashesbackend (/marketplace-proxy/...)
// elashesbackend reenvía internamente a backend_marketplace usando MARKETPLACE_BACKEND_URL en su .env.
// El frontend solo necesita VITE_API_URL; no hay URL separada para marketplace.

const marketplaceApi = {
  get: <T>(url: string, config?: Parameters<typeof api.get>[1]) =>
    api.get<T>(`/marketplace-proxy${url}`, config),
  post: <T>(url: string, data?: unknown, config?: Parameters<typeof api.post>[1]) =>
    api.post<T>(`/marketplace-proxy${url}`, data, config),
  put: <T>(url: string, data?: unknown, config?: Parameters<typeof api.put>[1]) =>
    api.put<T>(`/marketplace-proxy${url}`, data, config),
  patch: <T>(url: string, data?: unknown, config?: Parameters<typeof api.patch>[1]) =>
    api.patch<T>(`/marketplace-proxy${url}`, data, config),
  delete: <T>(url: string, config?: Parameters<typeof api.delete>[1]) =>
    api.delete<T>(`/marketplace-proxy${url}`, config),
};

/** Base URL del backend principal (elashesbackend) para resolver rutas de media del marketplace. */
export const MARKETPLACE_MEDIA_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL?.replace(/\/api\/?$/, "")) ||
  "http://34.55.150.142";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MarketplaceCategory {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceProduct {
  id: number;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  category_id: number | null;
  category_name: string | null;
  /** Alias of category_name — kept for backwards compat with existing pages. */
  category: string | null;
  stock: number;
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceStats {
  total: number;
  active: number;
  inactive: number;
  categories: number;
  avg_price: number;
}

export interface CreateProductPayload {
  name: string;
  brand?: string;
  description?: string;
  price: number;
  original_price?: number;
  category_id?: number;
  stock?: number;
  image?: File | null;
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {
  is_active?: boolean;
}

/** Producto del inventario de elashesbackend (tipo local en ImportInventoryPage) */
interface InventoryProduct {
  id: number;
  sku: string;
  name: string;
  price: number;
  cost: number;
  status: boolean;
  image_url: string | null;
  category_id: number | null;
  category: { id: number; name: string } | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface MarketplaceOrder {
  id: number;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  total: number;
  status: string;
  status_label: string;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string | null;
}

export interface AdminOrdersResponse {
  total: number;
  skip: number;
  limit: number;
  items: MarketplaceOrder[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type FormValue = string | number | boolean | File | null | undefined;

function normalizeProduct(p: Record<string, unknown>): MarketplaceProduct {
  return { ...(p as MarketplaceProduct), category: (p.category_name as string | null) ?? null };
}

function buildFormData(payload: Record<string, FormValue>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (key === "image") {
      if (value instanceof File) fd.append("image", value);
    } else if (value !== undefined && value !== null) {
      fd.append(key, String(value));
    }
  }
  return fd;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function fetchAdminProducts(includeInactive = true): Promise<MarketplaceProduct[]> {
  const { data } = await marketplaceApi.get<Record<string, unknown>[]>(
    `/api/products/admin/all?include_inactive=${includeInactive}`
  );
  return data.map(normalizeProduct);
}

export async function createMarketplaceProduct(
  payload: CreateProductPayload
): Promise<MarketplaceProduct> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.post<Record<string, unknown>>("/api/products/admin", fd);
  return normalizeProduct(data);
}

export async function updateMarketplaceProduct(
  id: number,
  payload: UpdateProductPayload
): Promise<MarketplaceProduct> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.put<Record<string, unknown>>(
    `/api/products/admin/${id}`,
    fd
  );
  return normalizeProduct(data);
}

export async function deleteMarketplaceProduct(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/products/admin/${id}`);
}

// ── Inventory import ──────────────────────────────────────────────────────────

/** Trae todos los productos del inventario de elashesbackend. */
export async function fetchInventoryProducts(): Promise<InventoryProduct[]> {
  const { data } = await api.get<InventoryProduct[]>("/inventory/products?limit=500");
  return data;
}

/** Importa un producto del inventario al marketplace (sin subir imagen, usa la URL). */
export async function importInventoryProduct(payload: {
  name: string;
  price: number;
  brand?: string;
  description?: string;
  stock?: number;
  image_url?: string | null;
}): Promise<MarketplaceProduct> {
  const { data } = await marketplaceApi.post<Record<string, unknown>>(
    "/api/products/admin/import",
    payload
  );
  return normalizeProduct(data);
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function fetchAdminCategories(): Promise<MarketplaceCategory[]> {
  const { data } = await marketplaceApi.get<MarketplaceCategory[]>("/api/categories/admin");
  return data;
}

export async function createCategory(payload: {
  name: string;
  description?: string;
  image?: File | null;
}): Promise<MarketplaceCategory> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.post<MarketplaceCategory>("/api/categories/admin", fd);
  return data;
}

export async function updateCategory(
  id: number,
  payload: { name?: string; description?: string; is_active?: boolean; image?: File | null }
): Promise<MarketplaceCategory> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.put<MarketplaceCategory>(
    `/api/categories/admin/${id}`,
    fd
  );
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/categories/admin/${id}`);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function fetchAdminOrders(params?: {
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<AdminOrdersResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.skip !== undefined) query.set("skip", String(params.skip));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const { data } = await marketplaceApi.get<AdminOrdersResponse>(`/api/orders/admin?${query}`);
  return data;
}

export async function updateOrderStatus(id: number, status: string): Promise<MarketplaceOrder> {
  const { data } = await marketplaceApi.patch<MarketplaceOrder>(
    `/api/orders/admin/${id}/status`,
    { status }
  );
  return data;
}

export async function deleteOrder(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/orders/admin/${id}`);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function computeStats(products: MarketplaceProduct[]): MarketplaceStats {
  const active = products.filter((p) => p.is_active).length;
  const categories = new Set(products.map((p) => p.category_name).filter(Boolean)).size;
  const avg_price = products.length
    ? products.reduce((sum, p) => sum + p.price, 0) / products.length
    : 0;
  return { total: products.length, active, inactive: products.length - active, categories, avg_price };
}
