import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { Sale, SaleSummary } from './data-access/sales.model';
import { SalesService } from './data-access/sales.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { ToastService } from '../../shared/services/toast.service';
import { SaleFormDialog } from './sale-form-dialog/sale-form-dialog';
import { SaleDetailDialog } from './sale-detail-dialog/sale-detail-dialog';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { financialStatusLabel, paymentTypeLabel } from './data-access/sales.labels';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { financialStatusTone } from './data-access/sales.labels';

@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    MatIconModule,
    MatTableModule,
    MetricCard,
    MatButtonModule,
    MatPaginatorModule,
    MatTooltipModule,
    StatusBadge,
  ],
  selector: 'app-sales',
  styleUrl: './sales.scss',
  templateUrl: './sales.html',
})
export class Sales implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;

  protected readonly sales = signal<Sale[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<SaleSummary | null>(null);
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = [
    'sale',
    'customer',
    'paymentType',
    'total',
    'balance',
    'paymentStatus',
    'actions',
  ];

  protected readonly totalSales = computed(() => this.summary()?.totalSales ?? 0);

  protected readonly totalRevenue = computed(() => this.summary()?.totalRevenue ?? 0);

  protected readonly todaySales = computed(() => this.summary()?.todaySales ?? 0);

  protected readonly averageTicket = computed(() => this.summary()?.averageTicket ?? 0);
  protected readonly collectedAmount = computed(() => this.summary()?.collectedAmount ?? 0);
  protected readonly outstandingAmount = computed(() => this.summary()?.outstandingAmount ?? 0);
  protected readonly historicalPaidAmount = computed(
    () => this.summary()?.historicalPaidAmount ?? 0,
  );
  protected readonly financialLabel = financialStatusLabel;
  protected readonly financialTone = financialStatusTone;
  protected readonly typeLabel = paymentTypeLabel;

  protected readonly canCreateSale = computed(
    () =>
      this.session.hasPermission('sales:create') &&
      this.session.hasPermission('customers:read') &&
      this.session.hasPermission('products:read') &&
      this.session.hasPermission('employees:read'),
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadSales();
  }

  protected loadSales() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.listRequest = this.salesService
      .getSales({
        page: this.pageIndex(),
        size: this.pageSize(),
        sort: 'saleDateTime,desc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.sales.set(page.content);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar las ventas.');
          this.loading.set(false);
        },
      });
  }

  protected loadSummary() {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.salesService
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summaryError.set('No fue posible actualizar las métricas.');
          this.summaryLoading.set(false);
        },
      });
  }

  protected pageChanged(event: PageEvent) {
    if (this.loading()) {
      return;
    }
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadSales();
  }

  protected saleCode(sale: Sale) {
    return sale.id.slice(0, 8).toUpperCase();
  }

  protected customerLabel(sale: Sale) {
    return sale.customerName || 'Cliente general';
  }

  protected openCreateSaleDialog() {
    const dialogRef = this.dialog.open(SaleFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '1180px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Venta registrada correctamente.');
        this.loadSummary();
        this.loadSales();
      }
    });
  }

  protected openSaleDetailDialog(sale: Sale) {
    const dialogRef = this.dialog.open(SaleDetailDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '1180px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: sale,
    });
    const detail = dialogRef.componentInstance;
    dialogRef.afterClosed().subscribe(() => {
      if (detail.hasChanges()) {
        this.loadSummary();
        this.loadSales();
      }
    });
  }
}
