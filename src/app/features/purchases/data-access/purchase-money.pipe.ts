import { Pipe, PipeTransform } from '@angular/core';
import { Decimal } from './purchases.model';

@Pipe({ name: 'purchaseMoney' })
export class PurchaseMoneyPipe implements PipeTransform {
  transform(value: Decimal | null | undefined, maximumFractionDigits = 2): string {
    if (value === null || value === undefined) return '—';
    const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
    if (!match) return '—';
    // Los importes ya vienen redondeados por backend; no convertir a Number.
    const integer = new Intl.NumberFormat('es-CO').format(BigInt(match[1]));
    const fraction = (match[2] ?? '')
      .slice(0, maximumFractionDigits)
      .replace(/0+$/, '')
      .padEnd(2, '0');
    return `$ ${integer},${fraction}`;
  }
}
