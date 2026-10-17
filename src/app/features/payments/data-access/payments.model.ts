import { PageRequest } from '../../../shared/data-access/page.model';
import { PaymentMethod, PaymentStatus } from '../../sales/data-access/sales.model';

export type PaymentListItem = {
  id: string;
  saleId: string;
  customerId: string | null;
  customerName: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDateTime: string;
  registeredByName: string;
  deletedAt: string | null;
};

export type PaymentFilters = {
  customerName?: string | null;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: PaymentMethod | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  includeDeleted?: boolean;
};

export type PaymentPageRequest = Pick<PageRequest, 'page' | 'size'> & PaymentFilters;
