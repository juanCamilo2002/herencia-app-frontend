export type SaleSummary = {
  totalSales: number;
  totalRevenue: number;
  todaySales: number;
  averageTicket: number;
};

export type SaleStatus = 'COMPLETED';

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
    saleDateTime: string;
    registeredById: string | null;
    registeredByName: string;
    createdAt: string;
    items: SaleItem[];
}

export type CreateSaleItemRequest = {
    productId: string;
    quantity: number;
    customUnitPrice: number | null;
}

export type CreateSaleRequest = {
    customerId: string | null;
    customerName: string | null;
    employeeId: string;
    saleDateTime: string;
    items: CreateSaleItemRequest[];
}