import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CreateStockMovementRequest, InventorySummary, StockMovement } from './inventory.model';
import { PageRequest, PageResponse } from '../../../shared/data-access/page.model';
import { pageParams } from '../../../shared/data-access/page-params';

@Injectable({
    providedIn: 'root'
})
export class InventoryService {
    private readonly http = inject(HttpClient);

    getMovements(request: PageRequest) {
        return this.http.get<PageResponse<StockMovement>>('/inventory/movements', {
            params: pageParams(request),
        });
    }
    getSummary() {
        return this.http.get<InventorySummary>('/inventory/movements/summary');
    }


    getMovementsByProduct(productId: string) {
        return this.http.get<StockMovement[]>(`/inventory/movements/product/${productId}`);
    }

    createMovement(request: CreateStockMovementRequest) {
        return this.http.post<StockMovement>('/inventory/movements', request);
    }
}