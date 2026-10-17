import { CreateSaleInstallmentRequest } from './sales.model';

// La vista previa usa centavos enteros; el backend recalcula y valida el plan.
export function generateInstallmentSchedule(
  date: Date | null,
  totalAmount: number,
  count: number,
  firstAmount: number | null,
): CreateSaleInstallmentRequest[] {
  const total = Math.round(totalAmount * 100);
  if (
    !date ||
    !Number.isFinite(date.getTime()) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 1000 ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return [];
  }

  if (
    firstAmount != null &&
    (!Number.isFinite(firstAmount) ||
      firstAmount <= 0 ||
      Math.abs(firstAmount * 100 - Math.round(firstAmount * 100)) > 0.00001)
  ) {
    return [];
  }

  const first = firstAmount == null ? null : Math.round(firstAmount * 100);
  if (count === 1) {
    return first != null && first !== total
      ? []
      : [{ dueDate: localDateString(date), amount: total / 100 }];
  }
  if (first != null && first >= total) {
    return [];
  }

  const regular = Math.floor((total - (first ?? 0)) / (count - (first == null ? 0 : 1)));
  if (regular < 1) {
    return [];
  }

  let remaining = total;
  return Array.from({ length: count }, (_, index) => {
    let amount = regular;

    if (index === count - 1) {
      amount = remaining;
    } else if (index === 0 && first != null) {
      amount = first;
    }

    remaining -= amount;
    const due = new Date(date.getFullYear(), date.getMonth() + index, 1);
    const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(date.getDate(), lastDay));
    return { dueDate: localDateString(due), amount: amount / 100 };
  });
}

function localDateString(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
