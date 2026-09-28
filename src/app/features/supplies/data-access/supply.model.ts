export type SupplyUnit =
  | 'UNIT'
  | 'GRAM'
  | 'KILOGRAM'
  | 'MILLILITER'
  | 'LITER'
  | 'METER'
  | 'PACKAGE';

export type Supply = {
  id: string;
  name: string;
  category: string | null;
  unit: SupplyUnit;
  unitCost: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplySummary = {
  totalSupplies: number;
  lowStockSupplies: number;
  availableStock: number;
  inventoryValue: number;
};

export type CreateSupplyRequest = {
  name: string;
  category?: string | null;
  unit: SupplyUnit;
  unitCost: number;
  stock: number;
  minimumStock: number;
};

export type UpdateSupplyRequest = {
  name: string;
  category?: string | null;
  unit: SupplyUnit;
  unitCost: number;
  minimumStock: number;
  active: boolean;
};