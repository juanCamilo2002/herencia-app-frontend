import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { ToastService } from '../../shared/services/toast.service';
import { InventoryMovementDialog } from './inventory-movement-dialog/inventory-movement-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { InventoryService } from './data-access/inventory.service';
import { InventorySummary, StockMovement, StockMovementSourceType, StockMovementType } from './data-access/inventory.model';
import { AuthSessionService } from '../../core/auth/auth-session.service';

@Component({
  imports: [
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MetricCard,
    MatPaginatorModule
  ],
  selector: 'app-inventory',
  styleUrl: './inventory.scss',
  templateUrl: './inventory.html'
})
export class Inventory implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<InventorySummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = [
    'movement',
    'product',
    'quantity',
    'stock',
    'source',
    'reason',
    'movementDateTime'
  ];

  protected readonly totalMovements = computed(() => this.summary()?.totalMovements ?? 0);
  protected readonly inboundMovements = computed(() => this.summary()?.inboundMovements ?? 0);
  protected readonly outboundMovements = computed(() => this.summary()?.outboundMovements ?? 0);
  protected readonly adjustmenMovements = computed(() => this.summary()?.adjustmentMovements ?? 0);
  protected readonly lossMovements = computed(() => this.summary()?.lossMovements ?? 0);

  protected readonly canCreateMovement = computed(() =>
    this.session.hasPermission('inventory:create') &&
    this.session.hasPermission('products:read')
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadMovements();
  }

  private loadMovements() {
    this.loading.set(true);
    this.error.set(null);

    this.inventoryService.getMovements({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: 'movementDateTime,desc'
    }).subscribe({
      next: (page) => {
        this.movements.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los movimientos de inventario.');
        this.loading.set(false);
      }
    });
  }

  private loadSummary() {
    this.inventoryService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary)
    });
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadMovements();
  }

  protected movementLabel(type: StockMovementType) {
    switch (type) {
      case 'INBOUND':
        return 'Entrada';
      case 'OUTBOUND':
        return 'Salida';
      case 'ADJUSTMENT':
        return 'Ajuste';
      case 'LOSS':
        return 'Merma';
    }
  }

  protected movementIcon(type: StockMovementType) {
    switch (type) {
      case 'INBOUND':
        return 'add_box';
      case 'OUTBOUND':
        return 'indeterminate_check_box';
      case 'ADJUSTMENT':
        return 'tune';
      case 'LOSS':
        return 'report_problem'
    }
  }

  protected movementTone(type: StockMovementType) {
    switch (type) {
      case 'INBOUND':
        return 'movement-badge--success';
      case 'OUTBOUND':
        return 'movement-badge--warning';
      case 'ADJUSTMENT':
        return 'movement-badge--info';
      case 'LOSS':
        return 'movement-badge--loss';
    }
  }

  protected sourceLabel(sourceType: StockMovementSourceType | null) {
    switch (sourceType) {
      case 'MANUAL':
        return 'Manual';
      case 'SALE':
        return 'Venta';
      default:
        return 'Sin origen';
    }
  }

  protected movementDelta(movement: StockMovement) {
    const delta = movement.newStock - movement.previousStock;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  protected openCreateMovementDialog() {
    const dialogRef = this.dialog.open(InventoryMovementDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Movimiento registrado correctamente.');
        this.loadSummary();
        this.loadMovements();
      }
    });
  }
}