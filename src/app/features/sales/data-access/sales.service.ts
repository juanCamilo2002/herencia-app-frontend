import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { PageRequest, PageResponse } from "../../../shared/data-access/page.model";
import { pageParams } from "../../../shared/data-access/page-params";
import { CreateSaleRequest, Sale, SaleSummary } from "./sales.model";

@Injectable({
    providedIn: 'root'
})
export class SalesService {
    private readonly http = inject(HttpClient);

    getSales(request: PageRequest) {
        return this.http.get<PageResponse<Sale>>('/sales', {
            params: pageParams(request)
        });
    }

    getSummary() {
        return this.http.get<SaleSummary>('/sales/summary');
    }

    createSale(request: CreateSaleRequest) {
        return this.http.post<Sale>('/sales', request);
    }

    getSale(id: string) {
        return this.http.get<Sale>(`/sales/${id}`);
    }
}