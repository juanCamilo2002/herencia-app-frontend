export type SaleSummary = {
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  averageTicket: number;
  collectedAmount: number;
  outstandingAmount: number;
  historicalPaidAmount: number;
};

export type SaleStatus = 'COMPLETED';
export type SalePaymentType = 'CASH' | 'CREDIT';
export type SalePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'REGISTERED' | 'CONFIRM' | 'DECLINE';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'NEQUI' | 'DAVIPLATA' | 'OTHER';
export type SaleHistoryEventType =
  | 'SALE_CREATED'
  | 'PAYMENT_REGISTERED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_DELETED'
  | 'NOTE_ADDED'
  | 'HISTORICAL_SALE_MIGRATED'
  | 'PAYMENT_AGREEMENT_STATUS_CHANGED';

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  customPrice: boolean;
  subtotal: number;
};

export type Sale = {
  id: string;
  customerId: string | null;
  customerName: string;
  employeeId: string | null;
  employeeName: string | null;
  status: SaleStatus;
  total: number;
  paymentType: SalePaymentType;
  paymentStatus: SalePaymentStatus;
  paidAmount: number;
  balanceAmount: number;
  historical: boolean;
  saleDateTime: string;
  registeredById: string | null;
  registeredByName: string;
  createdAt: string;
  items: SaleItem[];
};

export type CreateSaleItemRequest = {
  productId: string;
  quantity: number;
  customUnitPrice: number | null;
};

export type CreateSaleRequest = {
  customerId: string | null;
  customerName: string | null;
  employeeId: string;
  saleDateTime: string;
  items: CreateSaleItemRequest[];
  paymentType: SalePaymentType;
  installmentCount?: number;
  firstInstallmentAmount?: number | null;
  installments?: CreateSaleInstallmentRequest[];
};

export type CreateSaleInstallmentRequest = {
  dueDate: string;
  amount: number;
};

export type SaleInstallment = CreateSaleInstallmentRequest & {
  id: string;
  installmentNumber: number;
  paidAmount: number;
  balanceAmount: number;
  status: SalePaymentStatus;
  overdue: boolean;
};

export type SalePaymentRequest = {
  amount: number;
  method: PaymentMethod;
  paymentDateTime: string;
  notes: string | null;
};

export type SalePayment = SalePaymentRequest & {
  id: string;
  saleId: string;
  status: PaymentStatus;
  registeredById: string;
  registeredByName: string;
  confirmedById: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  declinedById: string | null;
  declinedByName: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  deletedById: string | null;
  deletedByName: string | null;
  deletedAt: string | null;
  deletionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleHistory = {
  id: string;
  saleId: string;
  paymentId: string | null;
  eventType: SaleHistoryEventType;
  title: string;
  comment: string;
  performedById: string | null;
  performedByName: string;
  previousPaymentStatus: PaymentStatus | null;
  newPaymentStatus: PaymentStatus | null;
  details: Record<string, unknown>;
  createdAt: string;
};
