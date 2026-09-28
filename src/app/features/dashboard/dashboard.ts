import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { DashboardSummary } from './data-access/dashboard.model';
import { DashboardService } from './data-access/dashboard.service';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  imports: [CurrencyPipe, DatePipe, MetricCard, MatIconModule],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit() {
    this.loadSummary();
  }

  protected loadSummary() {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar el resumen del dashboard.');
        this.loading.set(false);
      },
    });
  }
}