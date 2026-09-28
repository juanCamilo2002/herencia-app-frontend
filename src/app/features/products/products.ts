import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ProductService } from './data-access/product.service';
import { Product, ProductSummary } from './data-access/product.model';
import { MatButtonModule } from '@angular/material/button';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
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
    MatPaginatorModule
  ],
  selector: 'app-products',
  styleUrl: './products.scss',
  templateUrl: './products.html'
})
export class Products implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

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
    'winery',
    'grapeVariety',
    'vintage',
    'price',
    'stock',
    'status',
    ...(this.hasProductActions() ? ['actions'] : [])
  ]);

  protected readonly sortedProducts = computed(() => this.products());

  protected readonly totalProducts = computed(() => this.summary()?.totalProducts ?? 0);
  protected readonly lowStockProducts = computed(() => this.summary()?.lowStockProducts ?? 0);
  protected readonly availableUnits = computed(() => this.summary()?.availableUnits ?? 0);
  protected readonly inventoryValue = computed(() => this.summary()?.inventoryValue ?? 0);

  protected readonly canCreateProduct = computed(() =>
    this.session.hasPermission('products:create')
  );

  protected readonly canUpdateProduct = computed(() =>
    this.session.hasPermission('products:update')
  );

  protected readonly canDeleteProduct = computed(() =>
    this.session.hasPermission('products:delete')
  );

  protected readonly hasProductActions = computed(() =>
    this.canUpdateProduct() || this.canDeleteProduct()
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadProducts();
  }

  protected loadProducts() {
    this.loading.set(true);
    this.error.set(null);

    this.productService.getProducts({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: this.sortParam()
    }).subscribe({
      next: (page) => {
        this.products.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los productos.');
        this.loading.set(false);
      }
    });
  }

  private loadSummary() {
    this.productService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  protected sortProducts(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadProducts();
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
    })
  }

  protected openEditProductDialog(product: Product) {
    const dialogRef = this.dialog.open(ProductFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { product }
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
        tone: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteProduct(product);
      }
    })
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
      }
    });
  }

}