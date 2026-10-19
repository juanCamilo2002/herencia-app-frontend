import { DatePipe } from '@angular/common';
import { PurchaseMoneyPipe } from './data-access/purchase-money.pipe';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import {
  PurchaseListItem,
  PurchaseStatus,
  PurchaseSummary,
  purchaseStatuses,
  purchaseStatusLabel,
  purchaseStatusTone,
} from './data-access/purchases.model';
import { PurchasesService, purchaseError } from './data-access/purchases.service';
import { PurchaseFormDialog } from './purchase-form-dialog/purchase-form-dialog';
import { PurchaseDetailDialog } from './purchase-detail-dialog/purchase-detail-dialog';

@Component({
  selector: 'app-purchases',
  imports: [
    PurchaseMoneyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTableModule,
    MetricCard,
    StatusBadge,
  ],
  templateUrl: './purchases.html',
  styleUrl: './purchases.scss',
})
export class Purchases implements OnInit {
  private readonly service = inject(PurchasesService);
  private readonly dialog = inject(MatDialog);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private listRequest?: Subscription;
  private summaryRequest?: Subscription;
  private applied = { search: null as string | null, status: null as PurchaseStatus | null };
  protected readonly rows = signal<PurchaseListItem[]>([]);
  protected readonly summary = signal<PurchaseSummary | null>(null);
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);
  protected readonly dialogOpen = signal(false);
  protected readonly statuses = purchaseStatuses;
  protected readonly statusLabel = purchaseStatusLabel;
  protected readonly statusTone = purchaseStatusTone;
  protected readonly columns = ['supplier', 'date', 'reference', 'total', 'status', 'actions'];
  protected readonly filters = this.fb.group({
    search: this.fb.nonNullable.control('', Validators.maxLength(160)),
    status: this.fb.control<PurchaseStatus | null>(null),
  });
  ngOnInit() {
    this.loadRows();
    this.loadSummary();
  }
  protected canCreate() {
    return this.session.hasPermission('purchases:create');
  }
  protected loadRows() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.listRequest = this.service
      .list(this.pageIndex(), this.pageSize(), this.applied.search, this.applied.status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.totalElements.set(page.totalElements);
          const last = Math.max(0, page.totalPages - 1);
          if (!page.content.length && this.pageIndex() > last) {
            this.pageIndex.set(last);
            this.loadRows();
            return;
          }
          this.rows.set(page.content);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(purchaseError(error, 'No fue posible cargar las compras.'));
        },
      });
  }
  protected loadSummary() {
    this.summaryRequest?.unsubscribe();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryRequest = this.service
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summaryLoading.set(false);
          this.summaryError.set('No fue posible actualizar las estadísticas.');
        },
      });
  }
  protected applyFilters() {
    if (this.dialogOpen()) return;
    this.filters.markAllAsTouched();
    if (this.filters.invalid) return;
    const value = this.filters.getRawValue();
    this.applied = { search: value.search.trim() || null, status: value.status };
    this.pageIndex.set(0);
    this.loadRows();
  }
  protected clearFilters() {
    this.filters.reset({ search: '', status: null });
    this.applyFilters();
  }
  protected pageChanged(event: PageEvent) {
    if (this.loading() || this.dialogOpen()) return;
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadRows();
  }
  protected create() {
    if (!this.canCreate() || this.dialogOpen()) return;
    this.dialogOpen.set(true);
    this.dialog
      .open(PurchaseFormDialog, {
        data: null,
        width: '1080px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100dvh - 32px)',
        panelClass: 'app-dialog-panel',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.dialogOpen.set(false);
        if (saved) {
          this.pageIndex.set(0);
          this.loadRows();
          this.loadSummary();
        }
      });
  }
  protected detail(id: string) {
    if (this.dialogOpen()) return;
    this.dialogOpen.set(true);
    const ref = this.dialog.open(PurchaseDetailDialog, {
      data: id,
      width: '1000px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      autoFocus: false,
    });
    const detail = ref.componentInstance;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dialogOpen.set(false);
        if (detail.hasChanges()) {
          this.loadRows();
          this.loadSummary();
        }
      });
  }
}
