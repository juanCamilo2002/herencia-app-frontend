import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ToastService } from '../../shared/services/toast.service';
import { Supply, SupplySummary } from './data-access/supply.model';
import { SupplyService } from './data-access/supply.service';
import { SupplyFormDialog } from './supply-form-dialog/supply-form-dialog';
import { supplyUnitLabel } from './data-access/supply-labels';

@Component({
  imports: [
    CurrencyPipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MetricCard,
  ],
  selector: 'app-supplies',
  styleUrl: './supplies.scss',
  templateUrl: './supplies.html',
})
export class Supplies implements OnInit {
  private readonly supplyService = inject(SupplyService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly supplies = signal<Supply[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });

  protected readonly summary = signal<SupplySummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);
  
  protected readonly unitLabel = supplyUnitLabel;

  protected readonly displayedColumns = computed(() => [
    'supply',
    'category',
    'unit',
    'unitCost',
    'stock',
    'status',
    ...(this.hasSupplyActions() ? ['actions'] : []),
  ]);

  protected readonly totalSupplies = computed(() => this.summary()?.totalSupplies ?? 0);
  protected readonly lowStockSupplies = computed(() => this.summary()?.lowStockSupplies ?? 0);
  protected readonly inventoryValue = computed(() => this.summary()?.inventoryValue ?? 0);

  protected readonly canCreateSupply = computed(() => this.session.hasPermission('supplies:create'));
  protected readonly canUpdateSupply = computed(() => this.session.hasPermission('supplies:update'));
  protected readonly canDeleteSupply = computed(() => this.session.hasPermission('supplies:delete'));

  protected readonly hasSupplyActions = computed(() =>
    this.canUpdateSupply() || this.canDeleteSupply()
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadSupplies();
  }

  protected loadSupplies() {
    this.loading.set(true);
    this.error.set(null);

    this.supplyService.getSupplies({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: this.sortParam(),
    }).subscribe({
      next: (page) => {
        this.supplies.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los insumos.');
        this.loading.set(false);
      },
    });
  }

  protected sortSupplies(sort: Sort) {
    this.sort.set(sort);
    this.pageIndex.set(0);
    this.loadSupplies();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadSupplies();
  }

  protected isLowStock(supply: Supply) {
    return supply.stock <= supply.minimumStock;
  }

  protected openCreateSupplyDialog() {
    const dialogRef = this.dialog.open(SupplyFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Insumo creado correctamente.');
        this.loadSummary();
        this.loadSupplies();
      }
    });
  }

  protected openEditSupplyDialog(supply: Supply) {
    const dialogRef = this.dialog.open(SupplyFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      data: { supply },
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.toast.success('Insumo actualizado correctamente.');
        this.loadSummary();
        this.loadSupplies();
      }
    });
  }

  protected confirmDeleteSupply(supply: Supply) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Desactivar insumo',
        message: `Se desactivará "${supply.name}". Se conservará su historial de inventario.`,
        confirmText: 'Desactivar',
        cancelText: 'Cancelar',
        tone: 'danger',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteSupply(supply);
      }
    });
  }

  private loadSummary() {
    this.supplyService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  private deleteSupply(supply: Supply) {
    this.supplyService.deleteSupply(supply.id).subscribe({
      next: () => {
        this.toast.success('Insumo desactivado correctamente.');
        this.loadSummary();
        this.loadSupplies();
      },
      error: () => {
        this.toast.error('No fue posible desactivar el insumo.');
      },
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