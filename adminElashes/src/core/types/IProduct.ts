export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  categoryId?: number;
  supplier: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  description: string;
  active: boolean;
  imageUrl?: string;
  updatedAt: string;
};