import { SupplyUnit } from '../../supplies/data-access/supply.model';

export type SupplyInventorySummary = {
  totalMovements: number;
  inboundMovements: number;
  outboundMovements: number;
  adjustmentMovements: number;
  lossMovements: number;
};

export type SupplyMovementType = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'LOSS';

export type SupplyMovementSourceType = 'MANUAL' | 'PRODUCTION';

export type SupplyMovement = {
  id: string;
  supplyId: string;
  supplyName: string;
  supplyUnit: SupplyUnit;
  type: SupplyMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  sourceType: SupplyMovementSourceType | null;
  sourceId: string | null;
  movementDateTime: string;
  createdAt: string;
};

export type CreateSupplyMovementRequest = {
  supplyId: string;
  type: SupplyMovementType;
  quantity: number;
  movementDateTime: string;
  reason: string | null;
};