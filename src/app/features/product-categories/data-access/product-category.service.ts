import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export type ProductCategory = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type ProductCategoryRequest = { name: string; description: string | null };

@Injectable({ providedIn: 'root' })
export class ProductCategoryService {
  private readonly http = inject(HttpClient);
  list() {
    return this.http.get<ProductCategory[]>('/product-categories');
  }
  options(includeInactive = false) {
    return this.http.get<ProductCategory[]>('/product-categories/options', {
      params: { includeInactive },
    });
  }
  create(request: ProductCategoryRequest) {
    return this.http.post<ProductCategory>('/product-categories', request);
  }
  update(id: string, request: ProductCategoryRequest) {
    return this.http.put<ProductCategory>(`/product-categories/${id}`, request);
  }
  setActive(id: string, active: boolean) {
    return this.http.put<ProductCategory>(`/product-categories/${id}/active`, { active });
  }
}

export function productCatalogError(error: unknown, fallback: string) {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const messages: Record<string, string> = {
    'A category with this name already exists.':
      'Ya existe una categoría con ese nombre, incluso si está inactiva.',
    'An inactive category cannot be assigned to a product.':
      'La categoría fue desactivada. Selecciona otra o deja el producto sin categoría.',
    'Product category not found': 'La categoría ya no está disponible. Actualiza las opciones.',
    'Product attribute names cannot be repeated.': 'No repitas nombres de características.',
  };
  return messages[error.error?.message] ?? fallback;
}
