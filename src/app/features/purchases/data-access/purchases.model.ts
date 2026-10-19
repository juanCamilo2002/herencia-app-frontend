import type { SupplyUnit } from '../../supplies/data-access/supply.model';

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type Decimal = string | number;
export type PurchaseLine = {
  id: string;
  productId: string | null;
  supplyId: string | null;
  itemName: string;
  itemUnit: SupplyUnit;
  quantity: Decimal;
  unitCost: Decimal;
  subtotal: Decimal;
  previousStock: Decimal | null;
  newStock: Decimal | null;
  previousAverageCost: Decimal | null;
  receivedAverageCost: Decimal | null;
  costInitializationId: string | null;
  initialUnitCost: Decimal | null;
};
export type PurchaseListItem = {
  id: string;
  version: number;
  supplierId: string;
  supplierName: string;
  purchaseDateTime: string;
  reference: string | null;
  status: PurchaseStatus;
  total: Decimal;
  receivedAt: string | null;
};
export type Purchase = PurchaseListItem & {
  requestId: string;
  notes: string | null;
  createdByName: string;
  createdAt: string;
  orderedAt: string | null;
  receivedByName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  items: PurchaseLine[];
  history: {
    id: string;
    eventType: string;
    comment: string;
    performedByName: string;
    createdAt: string;
    details: Record<string, unknown>;
  }[];
};
export type PurchaseRequest = {
  requestId: string;
  version: number;
  supplierId: string;
  purchaseDateTime: string;
  reference: string | null;
  notes: string | null;
  items: {
    productId: string | null;
    supplyId: string | null;
    quantity: string;
    unitCost: string;
  }[];
};
export type PurchaseSummary = {
  totalPurchases: number;
  orderedCount: number;
  orderedAmount: Decimal;
  receivedAmount: Decimal;
};
export type PurchaseCatalogOption = {
  id: string;
  type: 'PRODUCT' | 'SUPPLY';
  name: string;
  unit: SupplyUnit;
  stock: Decimal;
  averageUnitCost: Decimal | null;
  suggestedInitialCost: Decimal | null;
};
export type ReceiptPreview = {
  version: number;
  items: {
    itemId: string;
    itemName: string;
    itemUnit: SupplyUnit;
    currentStock: Decimal;
    averageUnitCost: Decimal | null;
    suggestedInitialCost: Decimal | null;
    active: boolean;
    unitMatches: boolean;
  }[];
};
export type ReceiptRequest = {
  version: number;
  receivedAt: string;
  declarations: { itemId: string; cost: { expectedStock: Decimal; unitCost: string } }[];
};

export const purchaseStatuses: { value: PurchaseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'ORDERED', label: 'Pendiente de recepción' },
  { value: 'RECEIVED', label: 'Recibida' },
  { value: 'CANCELLED', label: 'Cancelada' },
];
export const purchaseStatusLabel = (status: PurchaseStatus) =>
  purchaseStatuses.find((item) => item.value === status)?.label ?? status;
export const purchaseStatusTone = (
  status: PurchaseStatus,
): 'default' | 'warning' | 'success' | 'danger' =>
  (({ DRAFT: 'default', ORDERED: 'warning', RECEIVED: 'success', CANCELLED: 'danger' }) as const)[
    status
  ];
export function localPurchaseTime() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function scaled(value: Decimal, places: number): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match || (match[2]?.length ?? 0) > places) return null;
  return (
    BigInt(match[1]) * 10n ** BigInt(places) + BigInt((match[2] ?? '').padEnd(places, '0') || '0')
  );
}
function money(cents: bigint) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
export function purchaseLineTotal(quantity: Decimal, unitCost: Decimal) {
  const q = scaled(quantity, 3),
    c = scaled(unitCost, 2);
  return q === null || c === null ? '0.00' : money((q * c + 500n) / 1000n);
}
export function purchaseTotal(items: { quantity: Decimal; unitCost: Decimal }[]) {
  return money(
    items.reduce(
      (sum, item) => sum + (scaled(purchaseLineTotal(item.quantity, item.unitCost), 2) ?? 0n),
      0n,
    ),
  );
}
