import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import { Receivable, ReceivablePageRequest, ReceivableSummary } from './receivables.model';

@Injectable({
  providedIn: 'root',
})
export class ReceivablesService {
  private readonly http = inject(HttpClient);

  getReceivables(request: ReceivablePageRequest) {
    let params = pageParams(request);

    const customerName = request.customerName?.trim();

    if (customerName) {
      params = params.set('customerName', customerName);
    }

    if (request.paymentType) {
      params = params.set('paymentType', request.paymentType);
    }

    if (request.paymentStatus) {
      params = params.set('paymentStatus', request.paymentStatus);
    }

    return this.http.get<PageResponse<Receivable>>('/receivables', {
      params,
    });
  }

  getSummary() {
    return this.http.get<ReceivableSummary>('/receivables/summary');
  }
}
