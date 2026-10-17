import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import { SalePayment } from '../../sales/data-access/sales.model';
import { PaymentListItem, PaymentPageRequest } from './payments.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentsService {
  private readonly http = inject(HttpClient);

  getPayments(request: PaymentPageRequest) {
    let params = pageParams(request).set('includeDeleted', String(request.includeDeleted ?? false));

    const customerName = request.customerName?.trim();
    const dateFrom = request.dateFrom?.trim();
    const dateTo = request.dateTo?.trim();

    if (customerName) {
      params = params.set('customerName', customerName);
    }

    if (request.paymentStatus) {
      params = params.set('paymentStatus', request.paymentStatus);
    }

    if (request.paymentMethod) {
      params = params.set('paymentMethod', request.paymentMethod);
    }

    if (dateFrom) {
      params = params.set('dateFrom', dateFrom);
    }

    if (dateTo) {
      params = params.set('dateTo', dateTo);
    }

    return this.http.get<PageResponse<PaymentListItem>>('/payments', {
      params,
    });
  }

  getPayment(paymentId: string) {
    return this.http.get<SalePayment>(`/payments/${paymentId}`);
  }
}
