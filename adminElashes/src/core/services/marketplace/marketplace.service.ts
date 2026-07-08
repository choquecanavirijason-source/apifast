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

/**
 * Base para resolver rutas de media (imágenes) del marketplace.
 *
 * Los archivos (image_url = "/media/marketplace/...") viven físicamente en
 * backend_marketplace (puerto 8001), no en elashesbackend. nginx no expone
 * ese puerto directamente para media estática, así que hay que pasar por el
 * mismo proxy transparente que ya usan las llamadas a la API
 * (/marketplace-proxy/<path> -> backend_marketplace/<path>), igual como ya
 * lo documenta SettingsPage. Antes esto apuntaba directo a elashesbackend
 * (o al dominio pelado en prod) y las imágenes nunca cargaban.
 */
export const MARKETPLACE_MEDIA_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/marketplace-proxy`
    : undefined) ||
  "http://34.55.150.142/api/marketplace-proxy";

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
  video_url: string | null;
  category_id: number | null;
  category_name: string | null;
  /** Alias of category_name — kept for backwards compat with existing pages. */
  category: string | null;
  stock: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
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
  low_stock_threshold?: number;
  video_url?: string;
  image?: File | null;
  /** Archivo de video (mp4/mov/webm). Si se envía, tiene prioridad sobre video_url. */
  video?: File | null;
}

export interface UpdateProductPayload extends Partial<Omit<CreateProductPayload, "category_id">> {
  is_active?: boolean;
  category_id?: number | null;
}

export interface DashboardStats {
  products: { total: number; active: number; inactive: number; low_stock: number; out_of_stock: number };
  orders: { total: number; pending: number; confirmed: number; delivered: number };
  revenue: number;
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
  delivery_address: string | null;
  delivery_district: string | null;
  delivery_references: string | null;
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
    if (key === "image" || key === "video" || key === "thumbnail") {
      if (value instanceof File) fd.append(key, value);
    } else if (value !== undefined) {
      // null category_id/product_id → "0" so backend can clear it
      if (value === null && (key === "category_id" || key === "product_id")) fd.append(key, "0");
      else if (value !== null) fd.append(key, String(value));
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

export async function adjustProductStock(id: number, stock: number): Promise<MarketplaceProduct> {
  const { data } = await marketplaceApi.patch<Record<string, unknown>>(
    `/api/products/admin/${id}/stock`,
    { stock }
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

// ── Collections ───────────────────────────────────────────────────────────────

export interface CollectionPreviewProduct {
  id: number;
  name: string;
  image_url: string | null;
  price: number;
  category_name: string | null;
}

export interface MarketplaceCollection {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  product_count: number;
  preview_products: CollectionPreviewProduct[];
  created_at: string;
}

export async function fetchAdminCollections(): Promise<MarketplaceCollection[]> {
  const { data } = await marketplaceApi.get<MarketplaceCollection[]>("/api/collections/admin");
  return data;
}

export async function createCollection(payload: {
  name: string;
  description?: string;
  image?: File | null;
}): Promise<MarketplaceCollection> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.post<MarketplaceCollection>("/api/collections/admin", fd);
  return data;
}

export async function updateCollection(
  id: number,
  payload: { name?: string; description?: string; is_active?: boolean; image?: File | null }
): Promise<MarketplaceCollection> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.put<MarketplaceCollection>(`/api/collections/admin/${id}`, fd);
  return data;
}

export async function deleteCollection(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/collections/admin/${id}`);
}

export async function fetchCollectionProducts(colId: number): Promise<MarketplaceProduct[]> {
  const { data } = await marketplaceApi.get<Record<string, unknown>[]>(`/api/collections/admin/${colId}/products`);
  return data.map(normalizeProduct);
}

export async function addProductToCollection(colId: number, productId: number): Promise<MarketplaceCollection> {
  const { data } = await marketplaceApi.post<MarketplaceCollection>(
    `/api/collections/admin/${colId}/products/${productId}`
  );
  return data;
}

export async function removeProductFromCollection(colId: number, productId: number): Promise<void> {
  await marketplaceApi.delete(`/api/collections/admin/${colId}/products/${productId}`);
}

// ── Ads (publicidad / banners del carrusel) ────────────────────────────────────

export type AdLinkType =
  | "none" | "product" | "collection" | "category" | "url" | "booking" | "pickup" | "catalog";

export interface MarketplaceAd {
  id: number;
  title: string;
  subtitle: string | null;
  cta_label: string;
  image_url: string;
  link_type: AdLinkType;
  link_value: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateAdPayload {
  title: string;
  subtitle?: string;
  cta_label?: string;
  link_type?: AdLinkType;
  link_value?: string;
  sort_order?: number;
  image?: File | null;
}

export interface UpdateAdPayload extends Partial<CreateAdPayload> {
  is_active?: boolean;
}

export async function fetchAdminAds(): Promise<MarketplaceAd[]> {
  const { data } = await marketplaceApi.get<MarketplaceAd[]>("/api/ads/admin");
  return data;
}

export async function createAd(payload: CreateAdPayload): Promise<MarketplaceAd> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.post<MarketplaceAd>("/api/ads/admin", fd);
  return data;
}

export async function updateAd(id: number, payload: UpdateAdPayload): Promise<MarketplaceAd> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.put<MarketplaceAd>(`/api/ads/admin/${id}`, fd);
  return data;
}

export async function deleteAd(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/ads/admin/${id}`);
}

// ── Reels (videos cortos de aplicación de productos) ───────────────────────────

export interface ReelProductSummary {
  id: number;
  name: string;
  price: number;
  image_url: string | null;
}

export interface MarketplaceReel {
  id: number;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  product_id: number | null;
  product: ReelProductSummary | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateReelPayload {
  caption?: string;
  video_url?: string;
  product_id?: number;
  sort_order?: number;
  /** Archivo de video. Si se envía, tiene prioridad sobre video_url. */
  video?: File | null;
  thumbnail?: File | null;
}

export interface UpdateReelPayload extends Partial<CreateReelPayload> {
  is_active?: boolean;
}

export async function fetchAdminReels(): Promise<MarketplaceReel[]> {
  const { data } = await marketplaceApi.get<MarketplaceReel[]>("/api/reels/admin");
  return data;
}

export async function createReel(payload: CreateReelPayload): Promise<MarketplaceReel> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.post<MarketplaceReel>("/api/reels/admin", fd);
  return data;
}

export async function updateReel(id: number, payload: UpdateReelPayload): Promise<MarketplaceReel> {
  const fd = buildFormData(payload as Record<string, FormValue>);
  const { data } = await marketplaceApi.put<MarketplaceReel>(`/api/reels/admin/${id}`, fd);
  return data;
}

export async function deleteReel(id: number): Promise<void> {
  await marketplaceApi.delete(`/api/reels/admin/${id}`);
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface MarketplaceCustomer {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string;
  source: "app" | "salon";
}

export async function fetchCustomers(): Promise<MarketplaceCustomer[]> {
  const { data } = await marketplaceApi.get<MarketplaceCustomer[]>("/api/customers");
  return data;
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

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await marketplaceApi.get<DashboardStats>("/api/products/admin/stats");
  return data;
}

export async function fetchLowStockProducts(): Promise<MarketplaceProduct[]> {
  const { data } = await marketplaceApi.get<Record<string, unknown>[]>("/api/products/admin/low-stock");
  return data.map(normalizeProduct);
}
