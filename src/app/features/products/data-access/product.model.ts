export type ProductSummary = {
  totalProducts: number;
  lowStockProducts: number;
  availableUnits: number;
  inventoryValue: number;
};

export type ProductAttribute = { name: string; value: string };

export type Product = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryActive: boolean | null;
  description: string | null;
  attributes: ProductAttribute[];
  price: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductRequest = {
  name: string;
  categoryId: string | null;
  description: string | null;
  attributes: ProductAttribute[];
  price: number;
  stock: number;
  minimumStock: number;
};

export type UpdateProductRequest = Omit<CreateProductRequest, 'stock'> & { active: boolean };
export type ProductFilters = { name?: string; categoryId?: string; uncategorized?: boolean };
