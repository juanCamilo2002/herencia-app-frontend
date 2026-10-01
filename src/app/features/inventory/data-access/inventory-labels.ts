import { StockMovementSourceType, StockMovementType } from './inventory.model';

export function stockMovementLabel(type: StockMovementType) {
  switch (type) {
    case 'INBOUND':
      return 'Entrada';
    case 'OUTBOUND':
      return 'Salida';
    case 'ADJUSTMENT':
      return 'Ajuste';
    case 'LOSS':
      return 'Merma';
  }
}

export function stockMovementIcon(type: StockMovementType) {
  switch (type) {
    case 'INBOUND':
      return 'add_box';
    case 'OUTBOUND':
      return 'indeterminate_check_box';
    case 'ADJUSTMENT':
      return 'tune';
    case 'LOSS':
      return 'report_problem';
  }
}

export function stockMovementTone(type: StockMovementType) {
  switch (type) {
    case 'INBOUND':
      return 'movement-badge--success';
    case 'OUTBOUND':
      return 'movement-badge--warning';
    case 'ADJUSTMENT':
      return 'movement-badge--info';
    case 'LOSS':
      return 'movement-badge--loss';
  }
}

export function stockMovementSourceLabel(sourceType: StockMovementSourceType | null) {
  switch (sourceType) {
    case 'MANUAL':
      return 'Manual';
    case 'SALE':
      return 'Venta';
    case 'PRODUCTION':
      return 'Producción';
    default:
      return 'Sin origen';
  }
}