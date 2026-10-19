export type Supplier = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierRequest = {
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type SupplierOption = {
  id: string;
  name: string;
  document: string | null;
};

export type SupplierFilters = {
  name?: string | null;
  includeInactive?: boolean;
};
