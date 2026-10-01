export type InventorySummary = {
  totalMovements: number;
  inboundMovements: number;
  outboundMovements: number;
  adjustmentMovements: number;
  lossMovements: number;
};

export type StockMovementType = 'INBOUND'| 'OUTBOUND' | 'ADJUSTMENT' | 'LOSS';

export type StockMovementSourceType = 'MANUAL'| 'SALE' | 'PRODUCTION';

export type StockMovement = {
    id: string;
    productId: string;
    productName: string;
    type: StockMovementType,
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string | null;
    sourceType: StockMovementSourceType | null;
    sourceId: string | null;
    movementDateTime: string;
    createdAt: string;
}

export type CreateStockMovementRequest = {
    productId: string;
    type: StockMovementType;
    quantity: number;
    movementDateTime: string;
    reason: string | null;
}