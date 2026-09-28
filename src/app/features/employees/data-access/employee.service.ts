import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { PageRequest, PageResponse } from "../../../shared/data-access/page.model";
import { CreateEmployeeRequest, Employee, EmployeeSummary, UpdateEmployeeRequest } from "./employee.model";
import { pageParams } from "../../../shared/data-access/page-params";

@Injectable({ providedIn: 'root' })
export class EmployeeService {
    private readonly http = inject(HttpClient);

    getEmployees(request: PageRequest) {
        return this.http.get<PageResponse<Employee>>('/employees', {
            params: pageParams(request),
        });
    }

    getSummary() {
        return this.http.get<EmployeeSummary>('/employees/summary');
    }

    getEmployeeOptions() {
        return this.http.get<Employee[]>('/employees/options');
    }

    createEmployee(request: CreateEmployeeRequest) {
        return this.http.post<Employee>('/employees', request);
    }

    updateEmployee(id: string, request: UpdateEmployeeRequest) {
        return this.http.put<Employee>(`/employees/${id}`, request);
    }

    disableEmployee(id: string) {
        return this.http.delete<void>(`/employees/${id}`);
    }
}