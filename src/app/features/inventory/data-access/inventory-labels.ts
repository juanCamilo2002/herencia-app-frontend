import { StockMovementSourceType, StockMovementType } from './inventory.model';
import type { StatusBadgeTone } from '../../../shared/components/status-badge/status-badge';

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

export function stockMovementTone(type: StockMovementType): StatusBadgeTone {
  switch (type) {
    case 'INBOUND':
      return 'success';
    case 'OUTBOUND':
      return 'warning';
    case 'ADJUSTMENT':
      return 'primary';
    case 'LOSS':
      return 'danger';
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
