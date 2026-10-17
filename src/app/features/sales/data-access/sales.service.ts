import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import {
  CreateSaleRequest,
  Sale,
  SaleSummary,
  SaleInstallment,
  SalePayment,
  SalePaymentRequest,
  SaleHistory,
} from './sales.model';

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly http = inject(HttpClient);

  getSales(request: PageRequest) {
    return this.http.get<PageResponse<Sale>>('/sales', {
      params: pageParams(request),
    });
  }

  getSummary() {
    return this.http.get<SaleSummary>('/sales/summary');
  }

  createSale(request: CreateSaleRequest) {
    return this.http.post<Sale>('/sales', request);
  }

  getSale(id: string) {
    return this.http.get<Sale>(`/sales/${id}`);
  }

  getInstallments(saleId: string) {
    return this.http.get<SaleInstallment[]>(`/sales/${saleId}/installments`);
  }

  getPayments(saleId: string, request: PageRequest) {
    return this.http.get<PageResponse<SalePayment>>(`/sales/${saleId}/payments`, {
      params: pageParams(request),
    });
  }

  getPayment(saleId: string, paymentId: string) {
    return this.http.get<SalePayment>(`/sales/${saleId}/payments/${paymentId}`);
  }

  registerPayment(saleId: string, request: SalePaymentRequest) {
    return this.http.post<SalePayment>(`/sales/${saleId}/payments`, request);
  }

  updatePayment(saleId: string, paymentId: string, request: SalePaymentRequest) {
    return this.http.put<SalePayment>(`/sales/${saleId}/payments/${paymentId}`, request);
  }

  confirmPayment(saleId: string, paymentId: string) {
    return this.http.post<SalePayment>(`/sales/${saleId}/payments/${paymentId}/confirm`, {});
  }

  declinePayment(saleId: string, paymentId: string, reason: string) {
    return this.http.post<SalePayment>(`/sales/${saleId}/payments/${paymentId}/decline`, {
      reason,
    });
  }

  deletePayment(saleId: string, paymentId: string, reason: string) {
    return this.http.post<SalePayment>(`/sales/${saleId}/payments/${paymentId}/delete`, { reason });
  }

  getHistory(saleId: string, request: PageRequest) {
    return this.http.get<PageResponse<SaleHistory>>(`/sales/${saleId}/history`, {
      params: pageParams(request),
    });
  }

  addNote(saleId: string, title: string, comment: string) {
    return this.http.post<SaleHistory>(`/sales/${saleId}/notes`, { title, comment });
  }
}
