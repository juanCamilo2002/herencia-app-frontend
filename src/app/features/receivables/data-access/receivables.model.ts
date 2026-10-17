import { PageRequest } from '../../../shared/data-access/page.model';
import { SalePaymentStatus, SalePaymentType } from '../../sales/data-access/sales.model';

export type Receivable = {
  saleId: string;
  customerId: string | null;
  customerName: string | null;
  saleDateTime: string;
  paymentType: SalePaymentType;
  paymentStatus: SalePaymentStatus;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  overdueAmount: number;
  oldestPendingDueDate: string | null;
};

export type ReceivableSummary = {
  outstandingAmount: number;
  overdueAmount: number;
  salesWithBalance: number;
  overdueSales: number;
};

export type ReceivableStatusFilter = Exclude<SalePaymentStatus, 'PAID'>;

export type ReceivableFilters = {
  customerName?: string | null;
  paymentType?: SalePaymentType | null;
  paymentStatus?: ReceivableStatusFilter | null;
};

export type ReceivablePageRequest = Pick<PageRequest, 'page' | 'size'> & ReceivableFilters;
