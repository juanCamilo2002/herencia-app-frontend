export type ProductSummary = {
  totalProducts: number;
  lowStockProducts: number;
  availableUnits: number;
  inventoryValue: number;
};

export type Product = {
    id: string;
    name: string;
    winery: string | null;
    grapeVariety: string | null;
    vintage: number | null;
    price: number;
    stock: number;
    minimumStock: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CreateProductRequest = {
    name: string;
    winery?: string | null;
    grapeVariety?: string | null;
    vintage?: number | null;
    price: number;
    stock: number;
    minimumStock: number;
};

export type UpdateProductRequest = {
    name: string;
    winery?: string | null;
    grapeVariety?: string | null;
    vintage?: number | null;
    price: number;
    minimumStock: number;
    active: boolean;
};