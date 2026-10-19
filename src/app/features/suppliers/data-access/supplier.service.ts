import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';

import { Supplier, SupplierFilters, SupplierOption, SupplierRequest } from './supplier.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private readonly http = inject(HttpClient);

  getSuppliers(request: PageRequest, filters: SupplierFilters = {}) {
    let params = pageParams(request).set(
      'includeInactive',
      String(filters.includeInactive ?? false),
    );

    const name = filters.name?.trim();

    if (name) {
      params = params.set('name', name);
    }

    return this.http.get<PageResponse<Supplier>>('/suppliers', {
      params,
    });
  }

  getSupplier(id: string) {
    return this.http.get<Supplier>(`/suppliers/${id}`);
  }

  getSupplierOptions() {
    return this.http.get<SupplierOption[]>('/suppliers/options');
  }

  createSupplier(request: SupplierRequest) {
    return this.http.post<Supplier>('/suppliers', request);
  }

  updateSupplier(id: string, request: SupplierRequest) {
    return this.http.put<Supplier>(`/suppliers/${id}`, request);
  }

  setActive(id: string, active: boolean) {
    return this.http.put<Supplier>(`/suppliers/${id}/active`, { active });
  }
}
