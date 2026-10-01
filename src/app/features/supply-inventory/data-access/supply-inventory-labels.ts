import { SupplyMovementSourceType, SupplyMovementType } from './supply-inventory.model';

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

export function supplyMovementTone(type: SupplyMovementType) {
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
