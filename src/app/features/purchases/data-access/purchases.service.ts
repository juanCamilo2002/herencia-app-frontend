import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageResponse } from '../../../shared/data-access/page.model';
import {
  Purchase,
  PurchaseListItem,
  PurchaseStatus,
  PurchaseRequest,
  PurchaseSummary,
  PurchaseCatalogOption,
  ReceiptPreview,
  ReceiptRequest,
} from './purchases.model';

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly http = inject(HttpClient);
  list(page: number, size: number, search: string | null, status: PurchaseStatus | null) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    return this.http.get<PageResponse<PurchaseListItem>>('/purchases', { params });
  }
  summary() {
    return this.http.get<PurchaseSummary>('/purchases/summary');
  }
  get(id: string) {
    return this.http.get<Purchase>(`/purchases/${id}`);
  }
  catalog() {
    return this.http.get<PurchaseCatalogOption[]>('/purchases/catalog-options');
  }
  create(request: PurchaseRequest) {
    return this.http.post<Purchase>('/purchases', request);
  }
  update(id: string, request: PurchaseRequest) {
    return this.http.put<Purchase>(`/purchases/${id}`, request);
  }
  order(id: string, version: number) {
    return this.http.post<Purchase>(`/purchases/${id}/order`, { version });
  }
  cancel(id: string, version: number, reason: string) {
    return this.http.post<Purchase>(`/purchases/${id}/cancel`, { version, reason });
  }
  preview(id: string) {
    return this.http.get<ReceiptPreview>(`/purchases/${id}/receipt-preview`);
  }
  receive(id: string, request: ReceiptRequest) {
    return this.http.post<Purchase>(`/purchases/${id}/receive`, request);
  }
}

export function purchaseError(error: unknown, fallback = 'No fue posible completar la operación.') {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 409)
    return 'La compra cambió. Actualiza su detalle antes de intentar nuevamente.';
  if (error.status === 403) return 'No tienes permiso para esta operación.';
  const message = String(error.error?.message ?? '');
  if (message.includes('Stock changed'))
    return 'Las existencias cambiaron. Actualiza la recepción y confirma nuevamente los costos iniciales.';
  if (message.includes('no longer required'))
    return 'El costo inicial ya no requiere declaración. Actualiza la recepción.';
  if (message.includes('Initial inventory cost must'))
    return 'Debes confirmar el costo de las existencias anteriores.';
  if (message.includes('unit changed'))
    return 'La unidad del insumo cambió. Edita y revisa la compra antes de recibirla.';
  if (message.includes('Supplier is inactive'))
    return 'El proveedor está inactivo. Selecciona otro o reactívalo antes de confirmar el pedido.';
  if (message.includes('inactive'))
    return 'Uno de los artículos está inactivo. Revisa su estado antes de continuar.';
  if (message.includes('stock exceeds')) return 'La recepción supera el stock máximo permitido.';
  if (message.includes('Receipt time'))
    return 'La fecha de recepción debe estar entre la fecha de compra y el momento actual.';
  return fallback;
}
