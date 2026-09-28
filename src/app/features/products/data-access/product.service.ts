import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CreateProductRequest, Product, ProductSummary, UpdateProductRequest } from "./product.model";
import { PageRequest, PageResponse } from "../../../shared/data-access/page.model";
import { pageParams } from "../../../shared/data-access/page-params";

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private readonly http = inject(HttpClient);

    getProducts(request: PageRequest) {
        return this.http.get<PageResponse<Product>>('/products', {
            params: pageParams(request),
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
        return this.http.delete<void>(`/products/${id}`)
    }
}