import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CreateCustomerRequest, Customer, CustomerSummary, UpdateCustomerRequest } from "./customer.model";
import { PageRequest, PageResponse } from "../../../shared/data-access/page.model";
import { pageParams } from "../../../shared/data-access/page-params";

@Injectable({
    providedIn: 'root'
})
export class CustomerService {
    private readonly http = inject(HttpClient);

    getCustomers(request: PageRequest) {
        return this.http.get<PageResponse<Customer>>('/customers', {
            params: pageParams(request)
        });
    }

    getCustomerOptions() {
        return this.http.get<Customer[]>('/customers/options');
    }

    getSummary() {
        return this.http.get<CustomerSummary>('/customers/summary');
    }

    createCustomer(request: CreateCustomerRequest) {
        return this.http.post<Customer>('/customers', request);
    }

    updateCustomer(id: string, request: UpdateCustomerRequest) {
        return this.http.put(`/customers/${id}`, request);
    }

    deleteCustomer(id: string) {
        return this.http.delete<void>(`/customers/${id}`);
    }
}
