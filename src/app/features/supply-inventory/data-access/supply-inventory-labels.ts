import { SupplyMovementSourceType, SupplyMovementType } from './supply-inventory.model';
import type { StatusBadgeTone } from '../../../shared/components/status-badge/status-badge';

export function supplyMovementLabel(type: SupplyMovementType) {
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

export function supplyMovementIcon(type: SupplyMovementType) {
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

export function supplyMovementTone(type: SupplyMovementType): StatusBadgeTone {
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

export function supplyMovementSourceLabel(sourceType: SupplyMovementSourceType | null) {
  switch (sourceType) {
    case 'MANUAL':
      return 'Manual';
    case 'PRODUCTION':
      return 'Producción';
    default:
      return 'Sin origen';
  }
}
