import { SupplyUnit } from '../../supplies/data-access/supply.model';

export type ProductionStatus = 'COMPLETED';

export type ProductionSupplyItemType = 'CONSUMED' | 'LOSS';

export type ProductionProcessType = 'BOTTLING' | 'LABELING' | 'PACKAGING' | 'OTHER';

export type ProductionSummary = {
  totalProductions: number;
  outputUnits: number;
  consumedSupplies: number;
  lostSupplies: number;
};

export type ProductionProcess = {
  id: string;
  type: ProductionProcessType;
  name: string;
};

export type ProductionOutputItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
};

export type ProductionSupplyItem = {
  id: string;
  supplyId: string;
  supplyName: string;
  supplyUnit: SupplyUnit;
  type: ProductionSupplyItemType;
  quantity: number;
  reason: string | null;
};

export type Production = {
  id: string;
  productionDateTime: string;
  status: ProductionStatus;
  notes: string | null;
  registeredByName: string;
  processes: ProductionProcess[];
  outputs: ProductionOutputItem[];
  supplies: ProductionSupplyItem[];
  createdAt: string;
};

export type CreateProductionRequest = {
  productionDateTime: string;
  notes: string | null;
  processes: ProductionProcessType[];
  outputs: {
    productId: string;
    quantity: number;
  }[];
  supplies: {
    supplyId: string;
    type: ProductionSupplyItemType;
    quantity: number;
    reason: string | null;
  }[];
};