import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { AuthSessionService } from '../../core/auth/auth-session.service';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ToastService } from '../../shared/services/toast.service';
import {
  financialStatusLabel,
  financialStatusTone,
  paymentTypeLabel,
  salesErrorMessage,
} from '../sales/data-access/sales.labels';
import { SalePaymentType } from '../sales/data-access/sales.model';
import { SalesService } from '../sales/data-access/sales.service';
import { SaleDetailDialog } from '../sales/sale-detail-dialog/sale-detail-dialog';
import {
  Receivable,
  ReceivableFilters,
  ReceivableStatusFilter,
  ReceivableSummary,
} from './data-access/receivables.model';
import { ReceivablesService } from './data-access/receivables.service';

@Component({
  selector: 'app-receivables',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    MetricCard,
    StatusBadge,
  ],
  templateUrl: './receivables.html',
  styleUrl: './receivables.scss',
})
export class Receivables implements OnInit {
  private readonly service = inject(ReceivablesService);
  private readonly salesService = inject(SalesService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private listRequest?: Subscription;
  private summaryRequest?: Subscription;

  private readonly appliedFilters = signal<ReceivableFilters>({});

  protected readonly rows = signal<Receivable[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<ReceivableSummary | null>(null);
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);
  protected readonly openingSaleId = signal<string | null>(null);

  protected readonly financialLabel = financialStatusLabel;
  protected readonly financialTone = financialStatusTone;
  protected readonly typeLabel = paymentTypeLabel;

  protected readonly canOpenSale = computed(() => this.session.hasPermission('sales:read'));

  protected readonly hasActiveFilters = computed(() => {
    const filters = this.appliedFilters();

    return Boolean(filters.customerName || filters.paymentType || filters.paymentStatus);
  });

  protected readonly displayedColumns = computed(() => [
    'sale',
    'customer',
    'paymentType',
    'balance',
    'overdue',
    'dueDate',
    'paymentStatus',
    ...(this.canOpenSale() ? ['actions'] : []),
  ]);

  protected readonly filtersForm = this.formBuilder.group({
    customerName: this.formBuilder.nonNullable.control('', [Validators.maxLength(160)]),
    paymentType: this.formBuilder.control<SalePaymentType | null>(null),
    paymentStatus: this.formBuilder.control<ReceivableStatusFilter | null>(null),
  });

  ngOnInit(): void {
    this.loadSummary();
    this.loadRows();
  }

  protected loadRows() {
    this.listRequest?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);

    this.listRequest = this.service
      .getReceivables({
        page: this.pageIndex(),
        size: this.pageSize(),
        ...this.appliedFilters(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.totalElements.set(page.totalElements);

          // Una venta puede salir de Cartera después de pagarla.
          if (page.content.length === 0 && this.pageIndex() > 0) {
            this.pageIndex.set(Math.max(0, page.totalPages - 1));
            this.loadRows();
            return;
          }

          this.rows.set(page.content);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar la cartera.');
          this.loading.set(false);
        },
      });
  }

  protected loadSummary() {
    this.summaryRequest?.unsubscribe();

    this.summaryLoading.set(true);
    this.summaryError.set(null);

    this.summaryRequest = this.service
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summaryError.set('No fue posible actualizar el resumen de cartera.');
          this.summaryLoading.set(false);
        },
      });
  }

  protected applyFilters() {
    if (this.filtersForm.invalid) {
      this.filtersForm.markAllAsTouched();
      return;
    }

    const value = this.filtersForm.getRawValue();

    this.appliedFilters.set({
      customerName: value.customerName.trim() || null,
      paymentType: value.paymentType,
      paymentStatus: value.paymentStatus,
    });

    this.pageIndex.set(0);
    this.loadRows();
  }

  protected clearFilters() {
    this.filtersForm.reset({
      customerName: '',
      paymentType: null,
      paymentStatus: null,
    });

    this.applyFilters();
  }

  protected pageChanged(event: PageEvent) {
    if (this.loading()) {
      return;
    }

    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadRows();
  }

  protected saleCode(row: Receivable) {
    return row.saleId.slice(0, 8).toUpperCase();
  }

  protected openSale(row: Receivable) {
    if (!this.canOpenSale() || this.openingSaleId() !== null) {
      return;
    }

    this.openingSaleId.set(row.saleId);

    this.salesService
      .getSale(row.saleId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sale) => {
          this.openingSaleId.set(null);

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

          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              if (detail.hasChanges()) {
                this.loadSummary();
                this.loadRows();
              }
            });
        },
        error: (error) => {
          this.openingSaleId.set(null);

          this.toast.error(
            salesErrorMessage(error, 'No fue posible abrir el detalle de la venta.'),
          );
        },
      });
  }
}
