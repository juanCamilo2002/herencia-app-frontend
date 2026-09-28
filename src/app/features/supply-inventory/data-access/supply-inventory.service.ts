import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import {
  CreateSupplyMovementRequest,
  SupplyInventorySummary,
  SupplyMovement,
} from './supply-inventory.model';

@Injectable({ providedIn: 'root' })
export class SupplyInventoryService {
  private readonly http = inject(HttpClient);

  getMovements(request: PageRequest) {
    return this.http.get<PageResponse<SupplyMovement>>('/supply-inventory/movements', {
      params: pageParams(request),
    });
  }

  getSummary() {
    return this.http.get<SupplyInventorySummary>('/supply-inventory/movements/summary');
  }

  createMovement(request: CreateSupplyMovementRequest) {
    return this.http.post<SupplyMovement>('/supply-inventory/movements', request);
  }
}