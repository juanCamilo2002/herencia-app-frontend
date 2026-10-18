import { CurrencyPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ProductService } from './data-access/product.service';
import { Product, ProductSummary, ProductFilters } from './data-access/product.model';
import { MatButtonModule } from '@angular/material/button';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatDialog, MatDialogClose } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ProductCategory,
  ProductCategoryService,
} from '../product-categories/data-access/product-category.service';
import { ProductFormDialog } from './product-form-dialog/product-form-dialog';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/services/toast.service';
import { AuthSessionService } from '../../core/auth/auth-session.service';

@Component({
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
    StatusBadge,
    MatPaginatorModule,
    MatDialogClose,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  selector: 'app-products',
  styleUrl: './products.scss',
  templateUrl: './products.html',
})
export class Products implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly categoryService = inject(ProductCategoryService);
  private readonly fb = inject(FormBuilder);
  private readonly detailDialog = viewChild.required<TemplateRef<unknown>>('productDetail');
  private readonly appliedFilters = signal<ProductFilters>({});
  protected readonly categories = signal<ProductCategory[]>([]);
  protected readonly categoriesError = signal(false);
  protected readonly categoriesLoading = signal(false);
  protected readonly inspectedProduct = signal<Product | null>(null);
  protected readonly filtersForm = this.fb.nonNullable.group({
    name: ['', Validators.maxLength(120)],
    category: ['all'],
  });
  private listRequest?: Subscription;
  private summaryRequest?: Subscription;
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly summary = signal<ProductSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = computed(() => [
    'product',
    'category',
    'price',
    'stock',
    'status',
    'actions',
  ]);

  protected readonly sortedProducts = computed(() => this.products());

  protected readonly totalProducts = computed(() => this.summary()?.totalProducts ?? 0);
  protected readonly lowStockProducts = computed(() => this.summary()?.lowStockProducts ?? 0);
  protected readonly availableUnits = computed(() => this.summary()?.availableUnits ?? 0);
  protected readonly inventoryValue = computed(() => this.summary()?.inventoryValue ?? 0);

  protected readonly canCreateProduct = computed(() =>
    this.session.hasPermission('products:create'),
  );

  protected readonly canUpdateProduct = computed(() =>
    this.session.hasPermission('products:update'),
  );

  protected readonly canDeleteProduct = computed(() =>
    this.session.hasPermission('products:delete'),
  );

  protected readonly hasProductActions = computed(
    () => this.canUpdateProduct() || this.canDeleteProduct(),
  );

  ngOnInit(): void {
    this.loadCategories();
    this.loadSummary();
    this.loadProducts();
  }

  protected loadProducts() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.listRequest = this.productService
      .getProducts(
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
          this.products.set(page.content);
          this.totalElements.set(page.totalElements);
          if (
            page.content.length === 0 &&
            this.pageIndex() > 0 &&
            page.totalPages <= this.pageIndex()
          ) {
            this.pageIndex.set(Math.max(0, page.totalPages - 1));
            this.loadProducts();
            return;
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar los productos.');
          this.loading.set(false);
        },
      });
  }

  protected loadSummary() {
    this.summaryRequest?.unsubscribe();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryRequest = this.productService
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summaryError.set('No fue posible actualizar las estadísticas.');
          this.summaryLoading.set(false);
        },
      });
  }

  protected sortProducts(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadProducts();
  }

  protected loadCategories() {
    if (this.categoriesLoading()) return;
    this.categoriesLoading.set(true);
    this.categoriesError.set(false);
    this.categoryService
      .options(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.categoriesLoading.set(false);
        },
        error: () => {
          this.categoriesError.set(true);
          this.categoriesLoading.set(false);
        },
      });
  }

  protected applyFilters() {
    this.filtersForm.markAllAsTouched();
    if (this.filtersForm.invalid) return;
    const value = this.filtersForm.getRawValue();
    this.appliedFilters.set({
      name: value.name.trim() || undefined,
      categoryId:
        value.category !== 'all' && value.category !== 'uncategorized' ? value.category : undefined,
      uncategorized: value.category === 'uncategorized',
    });
    this.pageIndex.set(0);
    this.loadProducts();
  }

  protected clearFilters() {
    this.filtersForm.reset({ name: '', category: 'all' });
    this.applyFilters();
  }

  protected openDetailDialog(product: Product) {
    this.inspectedProduct.set(product);
    this.dialog.open(this.detailDialog(), {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      ariaLabel: 'Detalle de producto',
      autoFocus: 'first-tabbable',
    });
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProducts();
  }

  private sortParam() {
    const sort = this.sort();

    if (!sort.active || !sort.direction) {
      return 'name,asc';
    }

    return `${sort.active},${sort.direction}`;
  }

  protected isLowStock(product: Product) {
    return product.stock <= product.minimumStock;
  }

  protected openCreateProductDialog() {
    const dialogRef = this.dialog.open(ProductFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Producto creado correctamente.');
        this.loadSummary();
        this.loadProducts();
      }
    });
  }

  protected openEditProductDialog(product: Product) {
    const dialogRef = this.dialog.open(ProductFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { product },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Producto actualizado correctamente.');
        this.loadSummary();
        this.loadProducts();
      }
    });
  }

  protected confirmDeleteProduct(product: Product) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Eliminar producto',
        message: `Se desactivará "${product.name}" del catálogo. Podrás conservar su historial de ventas e inventario`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteProduct(product);
      }
    });
  }

  private deleteProduct(product: Product) {
    this.productService.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.success('Producto eliminado correctamente.');
        this.loadSummary();
        this.loadProducts();
      },
      error: () => {
        this.toast.error('No fue posible eliminar el producto.');
      },
    });
  }
}
