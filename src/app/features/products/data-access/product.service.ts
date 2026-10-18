import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateProductRequest,
  Product,
  ProductSummary,
  UpdateProductRequest,
  ProductFilters,
} from './product.model';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts(request: PageRequest, filters: ProductFilters = {}) {
    let params = pageParams(request);
    if (filters.name) params = params.set('name', filters.name);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.uncategorized) params = params.set('uncategorized', true);
    return this.http.get<PageResponse<Product>>('/products', {
      params,
    });
  }

  getProductOptions() {
    return this.http.get<Product[]>('/products/options');
  }

  getSummary() {
    return this.http.get<ProductSummary>('/products/summary');
  }

  createProduct(request: CreateProductRequest) {
    return this.http.post<Product>('/products', request);
  }

  updateProduct(id: string, request: UpdateProductRequest) {
    return this.http.put<Product>(`/products/${id}`, request);
  }

  deleteProduct(id: string) {
    return this.http.delete<void>(`/products/${id}`);
  }
}
