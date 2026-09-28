import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import { CreateSupplyRequest, Supply, SupplySummary, UpdateSupplyRequest } from './supply.model';

@Injectable({ providedIn: 'root' })
export class SupplyService {
  private readonly http = inject(HttpClient);

  getSupplies(request: PageRequest) {
    return this.http.get<PageResponse<Supply>>('/supplies', {
      params: pageParams(request),
    });
  }

  getSupplyOptions() {
    return this.http.get<Supply[]>('/supplies/options');
  }

  getSummary() {
    return this.http.get<SupplySummary>('/supplies/summary');
  }

  createSupply(request: CreateSupplyRequest) {
    return this.http.post<Supply>('/supplies', request);
  }

  updateSupply(id: string, request: UpdateSupplyRequest) {
    return this.http.put<Supply>(`/supplies/${id}`, request);
  }

  deleteSupply(id: string) {
    return this.http.delete<void>(`/supplies/${id}`);
  }
}