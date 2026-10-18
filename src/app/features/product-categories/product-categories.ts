import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/services/toast.service';
import {
  ProductCategory,
  ProductCategoryService,
  productCatalogError,
} from './data-access/product-category.service';
import { CategoryFormDialog } from './category-form-dialog/category-form-dialog';

@Component({
  selector: 'app-product-categories',
  imports: [MatButtonModule, MatIconModule, MatTableModule, StatusBadge],
  templateUrl: './product-categories.html',
  styleUrl: './product-categories.scss',
})
export class ProductCategories implements OnInit {
  private readonly service = inject(ProductCategoryService);
  private readonly session = inject(AuthSessionService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly rows = signal<ProductCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly changing = signal(false);
  protected readonly columns = ['name', 'description', 'active', 'actions'];
  ngOnInit() {
    this.load();
  }
  protected can(action: string) {
    return this.session.hasPermission(`product-categories:${action}`);
  }
  protected load() {
    if (this.changing()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar las categorías.');
          this.loading.set(false);
        },
      });
  }
  protected edit(category: ProductCategory | null = null) {
    if (this.changing() || !this.can(category ? 'update' : 'create')) return;
    this.dialog
      .open(CategoryFormDialog, {
        data: category,
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100dvh - 32px)',
        panelClass: 'app-dialog-panel',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }
  protected changeActive(category: ProductCategory) {
    if (this.changing() || !this.can('disable')) return;
    this.dialog
      .open(ConfirmDialog, {
        panelClass: 'app-dialog-panel',
        data: {
          title: category.active ? 'Desactivar categoría' : 'Reactivar categoría',
          message: category.active
            ? `Los productos de «${category.name}» conservarán su categoría. No podrá asignarse a otros productos.`
            : `«${category.name}» volverá a estar disponible para asignar.`,
          confirmText: category.active ? 'Desactivar' : 'Reactivar',
          cancelText: 'Cancelar',
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed || this.changing()) return;
        this.changing.set(true);
        this.service
          .setActive(category.id, !category.active)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (updated) => {
              this.rows.update((rows) =>
                rows.map((row) => (row.id === updated.id ? updated : row)),
              );
              this.changing.set(false);
              this.toast.success('Categoría actualizada.');
            },
            error: (error) => {
              this.changing.set(false);
              this.toast.error(productCatalogError(error, 'No fue posible cambiar el estado.'));
            },
          });
      });
  }
}
