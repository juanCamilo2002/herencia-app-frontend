import { HttpErrorResponse } from '@angular/common/http';
import type { StatusBadgeTone } from '../../../shared/components/status-badge/status-badge';
import { PaymentMethod, PaymentStatus, SalePaymentStatus, SalePaymentType } from './sales.model';

export const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'NEQUI', label: 'Nequi' },
  { value: 'DAVIPLATA', label: 'Daviplata' },
  { value: 'OTHER', label: 'Otro' },
];
export function paymentMethodLabel(value: PaymentMethod) {
  return paymentMethods.find((method) => method.value === value)?.label ?? value;
}

export function paymentStatusLabel(value: PaymentStatus) {
  return { REGISTERED: 'Registrado', CONFIRM: 'Confirmado', DECLINE: 'Rechazado' }[value];
}

export function financialStatusLabel(value: SalePaymentStatus) {
  return {
    PENDING: 'Pendiente',
    PARTIAL: 'Parcial',
    PAID: 'Pagada',
    OVERDUE: 'En mora',
  }[value];
}

export function financialStatusTone(value: SalePaymentStatus): StatusBadgeTone {
  switch (value) {
    case 'PAID':
      return 'success';

    case 'PARTIAL':
      return 'warning';

    case 'OVERDUE':
      return 'danger';

    default:
      return 'default';
  }
}

export function paymentStatusTone(value: PaymentStatus): StatusBadgeTone {
  switch (value) {
    case 'CONFIRM':
      return 'success';

    case 'DECLINE':
      return 'danger';

    default:
      return 'warning';
  }
}

export function paymentTypeLabel(value: SalePaymentType) {
  return value === 'CREDIT' ? 'Crédito' : 'Contado';
}
export function salesErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof HttpErrorResponse ? error.error?.message : null;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
