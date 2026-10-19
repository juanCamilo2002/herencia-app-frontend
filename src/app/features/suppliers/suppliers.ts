import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';

import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ToastService } from '../../shared/services/toast.service';
import { Supplier, SupplierFilters } from './data-access/supplier.model';
import { SupplierService } from './data-access/supplier.service';
import { SupplierFormDialog } from './supplier-form-dialog/supplier-form-dialog';

@Component({
  selector: 'app-suppliers',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    StatusBadge,
  ],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
})
export class Suppliers implements OnInit {
  private readonly service = inject(SupplierService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private listRequest?: Subscription;

  private readonly appliedFilters = signal<SupplierFilters>({
    includeInactive: false,
  });

  private readonly dialogOpen = signal(false);

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly changingId = signal<string | null>(null);

  protected readonly busy = computed(() => this.dialogOpen() || this.changingId() !== null);

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly sort = signal<Sort>({
    active: 'name',
    direction: 'asc',
  });

  protected readonly canCreate = computed(() => this.session.hasPermission('suppliers:create'));

  protected readonly canUpdate = computed(() => this.session.hasPermission('suppliers:update'));

  protected readonly canChangeState = computed(() =>
    this.session.hasPermission('suppliers:disable'),
  );

  protected readonly hasActions = computed(() => this.canUpdate() || this.canChangeState());

  protected readonly displayedColumns = computed(() => [
    'supplier',
    'document',
    'contact',
    'address',
    'status',
    ...(this.hasActions() ? ['actions'] : []),
  ]);

  protected readonly filtersForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.maxLength(160)],
    includeInactive: [false],
  });

  ngOnInit(): void {
    this.loadSuppliers();
  }

  protected loadSuppliers() {
    if (this.busy()) {
      return;
    }

    this.listRequest?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);
    this.actionError.set(null);

    this.listRequest = this.service
      .getSuppliers(
        {
          page: this.pageIndex(),
          size: this.pageSize(),
          sort: this.sortParam(),
        },
        this.appliedFilters(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.totalElements.set(page.totalElements);

          const lastPage = Math.max(0, page.totalPages - 1);

          if (page.content.length === 0 && this.pageIndex() > lastPage) {
            this.pageIndex.set(lastPage);
            this.loadSuppliers();
            return;
          }

          this.suppliers.set(page.content);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar los proveedores.');
          this.loading.set(false);
        },
      });
  }

  protected applyFilters() {
    if (this.loading() || this.busy()) {
      return;
    }

    this.filtersForm.markAllAsTouched();

    if (this.filtersForm.invalid) {
      return;
    }

    const value = this.filtersForm.getRawValue();

    this.appliedFilters.set({
      name: value.name.trim() || null,
      includeInactive: value.includeInactive,
    });

    this.pageIndex.set(0);
    this.loadSuppliers();
  }

  protected clearFilters() {
    if (this.loading() || this.busy()) {
      return;
    }

    this.filtersForm.reset({
      name: '',
      includeInactive: false,
    });

    this.applyFilters();
  }

  protected sortSuppliers(sort: Sort) {
    if (this.loading() || this.busy()) {
      return;
    }

    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadSuppliers();
  }

  protected pageChanged(event: PageEvent) {
    if (this.loading() || this.busy()) {
      return;
    }

    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadSuppliers();
  }

  protected openForm(supplier: Supplier | null = null) {
    if (this.loading() || this.busy()) {
      return;
    }

    if (supplier ? !this.canUpdate() : !this.canCreate()) {
      return;
    }

    this.actionError.set(null);
    this.dialogOpen.set(true);

    const ref = this.dialog.open(SupplierFormDialog, {
      data: supplier ? { supplier } : null,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      autoFocus: false,
      restoreFocus: true,
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.dialogOpen.set(false);

        if (!saved) {
          return;
        }

        if (!supplier) {
          this.pageIndex.set(0);
        }

        this.toast.success(
          supplier ? 'Proveedor actualizado correctamente.' : 'Proveedor creado correctamente.',
        );

        this.loadSuppliers();
      });
  }

  protected changeActive(supplier: Supplier) {
    if (this.loading() || this.busy() || !this.canChangeState()) {
      return;
    }

    const nextActive = !supplier.active;

    this.actionError.set(null);
    this.dialogOpen.set(true);

    const ref = this.dialog.open(ConfirmDialog, {
      panelClass: 'app-dialog-panel',
      restoreFocus: true,
      data: {
        title: nextActive ? 'Reactivar proveedor' : 'Desactivar proveedor',
        message: nextActive
          ? `«${supplier.name}» volverá a estar disponible para nuevas compras.`
          : `«${supplier.name}» dejará de estar disponible para nuevas compras. Sus registros anteriores se conservarán.`,
        confirmText: nextActive ? 'Reactivar' : 'Desactivar',
        cancelText: 'Cancelar',
        tone: nextActive ? 'default' : 'danger',
      },
    });

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.dialogOpen.set(false);

        if (!confirmed) {
          return;
        }

        this.changingId.set(supplier.id);

        this.service
          .setActive(supplier.id, nextActive)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.changingId.set(null);

              this.toast.success(
                nextActive
                  ? 'Proveedor reactivado correctamente.'
                  : 'Proveedor desactivado correctamente.',
              );

              this.loadSuppliers();
            },
            error: () => {
              this.changingId.set(null);
              this.actionError.set(
                'No fue posible cambiar el estado. Actualiza el listado antes de intentarlo nuevamente.',
              );
            },
          });
      });
  }

  private sortParam() {
    const sort = this.sort();

    if (!sort.active || !sort.direction) {
      return 'name,asc';
    }

    return `${sort.active},${sort.direction}`;
  }
}
