import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';
import { CreateProductionRequest, Production, ProductionSummary } from './production.model';

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly http = inject(HttpClient);

  getProductions(request: PageRequest) {
    return this.http.get<PageResponse<Production>>('/productions', {
      params: pageParams(request),
    });
  }

  getProduction(id: string) {
    return this.http.get<Production>(`/productions/${id}`);
  }

  getSummary() {
    return this.http.get<ProductionSummary>('/productions/summary');
  }

  createProduction(request: CreateProductionRequest) {
    return this.http.post<Production>('/productions', request);
  }
}