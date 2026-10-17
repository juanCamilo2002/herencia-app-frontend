import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ToastService } from '../../shared/services/toast.service';
import {
  paymentMethods,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  salesErrorMessage,
} from '../sales/data-access/sales.labels';
import { PaymentMethod, PaymentStatus } from '../sales/data-access/sales.model';
import { SalesService } from '../sales/data-access/sales.service';
import { SaleDetailDialog } from '../sales/sale-detail-dialog/sale-detail-dialog';
import { PaymentFilters, PaymentListItem } from './data-access/payments.model';
import { PaymentsService } from './data-access/payments.service';
import { PaymentDetailDialog } from './payment-detail-dialog/payment-detail-dialog';

function paymentDateRange(control: AbstractControl): ValidationErrors | null {
  const from = control.get('dateFrom')?.value;
  const to = control.get('dateTo')?.value;
  return from && to && from > to ? { dateRange: true } : null;
}

function paymentDate(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: true };
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? null
    : { date: true };
}

@Component({
  selector: 'app-payments',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    StatusBadge,
  ],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments implements OnInit {
  private readonly service = inject(PaymentsService);
  private readonly salesService = inject(SalesService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  private readonly appliedFilters = signal<PaymentFilters>({ includeDeleted: false });

  protected readonly rows = signal<PaymentListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);
  protected readonly openingSaleId = signal<string | null>(null);
  protected readonly methods = paymentMethods;
  protected readonly methodLabel = paymentMethodLabel;
  protected readonly statusLabel = paymentStatusLabel;
  protected readonly statusTone = paymentStatusTone;
  protected readonly canOpenSale = computed(() => this.session.hasPermission('sales:read'));
  protected readonly hasActiveFilters = computed(() => {
    const filters = this.appliedFilters();
    return Boolean(
      filters.customerName ||
      filters.paymentStatus ||
      filters.paymentMethod ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.includeDeleted,
    );
  });
  protected readonly displayedColumns = [
    'payment',
    'customer',
    'sale',
    'amount',
    'method',
    'status',
    'actions',
  ];

  protected readonly filtersForm = this.fb.group(
    {
      customerName: this.fb.nonNullable.control('', Validators.maxLength(160)),
      paymentStatus: this.fb.control<PaymentStatus | null>(null),
      paymentMethod: this.fb.control<PaymentMethod | null>(null),
      dateFrom: this.fb.nonNullable.control('', paymentDate),
      dateTo: this.fb.nonNullable.control('', paymentDate),
      includeDeleted: this.fb.nonNullable.control(false),
    },
    { validators: paymentDateRange },
  );

  ngOnInit(): void {
    this.loadRows();
  }

  protected loadRows() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.listRequest = this.service
      .getPayments({
        page: this.pageIndex(),
        size: this.pageSize(),
        ...this.appliedFilters(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.totalElements.set(page.totalElements);
          // Una modificación puede sacar el pago del filtro o eliminar la última página.
          if (page.content.length === 0 && this.pageIndex() > 0) {
            const lastPage = Math.max(0, page.totalPages - 1);
            if (lastPage < this.pageIndex()) {
              this.pageIndex.set(lastPage);
              this.loadRows();
              return;
            }
          }
          this.rows.set(page.content);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar los pagos.');
          this.loading.set(false);
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
      ...value,
      customerName: value.customerName.trim() || null,
      dateFrom: value.dateFrom || null,
      dateTo: value.dateTo || null,
    });
    this.pageIndex.set(0);
    this.loadRows();
  }

  protected clearFilters() {
    this.filtersForm.reset({
      customerName: '',
      paymentStatus: null,
      paymentMethod: null,
      dateFrom: '',
      dateTo: '',
      includeDeleted: false,
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

  protected code(id: string) {
    return id.slice(0, 8).toUpperCase();
  }

  protected openPayment(row: PaymentListItem) {
    if (!this.session.hasPermission('payments:read')) {
      return;
    }
    const ref = this.dialog.open(PaymentDetailDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '760px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { paymentId: row.id, customerName: row.customerName },
    });
    const detail = ref.componentInstance;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (detail.hasChanges()) {
          this.loadRows();
        }
      });
  }

  protected openSale(row: PaymentListItem) {
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
          const ref = this.dialog.open(SaleDetailDialog, {
            autoFocus: false,
            restoreFocus: false,
            width: '1180px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 32px)',
            panelClass: 'app-dialog-panel',
            data: sale,
          });
          const detail = ref.componentInstance;
          ref
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              if (detail.hasChanges()) {
                this.loadRows();
              }
            });
        },
        error: (error) => {
          this.openingSaleId.set(null);
          this.toast.error(salesErrorMessage(error, 'No fue posible abrir la venta.'));
        },
      });
  }
}
