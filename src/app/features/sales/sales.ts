import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { Sale, SaleStatus, SaleSummary } from './data-access/sales.model';
import { SalesService } from './data-access/sales.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { ToastService } from '../../shared/services/toast.service';
import { SaleFormDialog } from './sale-form-dialog/sale-form-dialog';
import { SaleDetailDialog } from './sale-detail-dialog/sale-detail-dialog';
import { AuthSessionService } from '../../core/auth/auth-session.service';

@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    MatIconModule,
    MatTableModule,
    MetricCard,
    MatButtonModule,
    MatPaginatorModule,
  ],
  selector: 'app-sales',
  styleUrl: './sales.scss',
  templateUrl: './sales.html'
})
export class Sales implements OnInit {
  private readonly salesService = inject(SalesService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);


  protected readonly sales = signal<Sale[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<SaleSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = [
    'sale',
    'customer',
    'employee',
    'items',
    'total',
    'saleDateTime',
    'registeredBy',
    'status',
    'actions'
  ];

  protected readonly totalSales = computed(() => this.summary()?.totalSales ?? 0);

  protected readonly totalRevenue = computed(() => this.summary()?.totalRevenue ?? 0);

  protected readonly todaySales = computed(() => this.summary()?.todaySales ?? 0);

  protected readonly averageTicket = computed(() => this.summary()?.averageTicket ?? 0);

  protected readonly canCreateSale = computed(() =>
    this.session.hasPermission('sales:create') &&
    this.session.hasPermission('customers:read') &&
    this.session.hasPermission('products:read') &&
    this.session.hasPermission('employees:read')
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadSales();
  }

  protected loadSales() {
    this.loading.set(true);
    this.error.set(null);

    this.salesService.getSales({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: 'saleDateTime,desc',
    }).subscribe({
      next: (page) => {
        this.sales.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar las ventas.');
        this.loading.set(false);
      }
    });
  }

  protected loadSummary() {
    this.salesService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary)
    });
  }

  protected pageChanged(event: PageEvent) {
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

  protected totalItems(sale: Sale) {
    return sale.items.reduce((total, item) => total + item.quantity, 0);
  }

  protected itemsSummary(sale: Sale) {
    if (sale.items.length === 0) {
      return 'Sin productos';
    }

    const [firstItem] = sale.items;
    const remainingItems = sale.items.length - 1;

    if (remainingItems === 0) {
      return `${firstItem.productName} x${firstItem.quantity}`;
    }

    return `${firstItem.productName} x${firstItem.quantity} + ${remainingItems} más`;
  }

  protected statusLabel(status: SaleStatus) {
    switch (status) {
      case 'COMPLETED':
        return 'Completada';
    }
  }

  protected openCreateSaleDialog() {
    const dialogRef = this.dialog.open(SaleFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '840px',
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
    this.dialog.open(SaleDetailDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '860px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: sale,
    });
  }
}