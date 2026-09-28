import { HttpClient } from '@angular/common/http';
import { inject, Injectable} from '@angular/core';
import { DashboardSummary } from './dashboard.model';

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private readonly http = inject(HttpClient);

    getSummary() {
        return this.http.get<DashboardSummary>('/dashboard/summary');
    }
}