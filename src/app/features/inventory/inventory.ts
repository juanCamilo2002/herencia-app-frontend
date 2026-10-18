import { DatePipe } from '@angular/common';
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
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogClose } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { ToastService } from '../../shared/services/toast.service';
import { InventoryMovementDialog } from './inventory-movement-dialog/inventory-movement-dialog';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { InventoryService } from './data-access/inventory.service';
import { InventorySummary, StockMovement } from './data-access/inventory.model';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import {
  stockMovementIcon,
  stockMovementLabel,
  stockMovementSourceLabel,
  stockMovementTone,
} from './data-access/inventory-labels';

@Component({
  imports: [
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MetricCard,
    StatusBadge,
    MatPaginatorModule,
    MatDialogClose,
  ],
  selector: 'app-inventory',
  styleUrl: './inventory.scss',
  templateUrl: './inventory.html',
})
export class Inventory implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reasonDialog = viewChild.required<TemplateRef<unknown>>('reasonDialog');
  protected readonly selectedMovement = signal<StockMovement | null>(null);
  private listRequest?: Subscription;
  private summaryRequest?: Subscription;
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);

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
    'movementDateTime',
  ];

  protected readonly movementLabel = stockMovementLabel;
  protected readonly movementIcon = stockMovementIcon;
  protected readonly movementTone = stockMovementTone;
  protected readonly sourceLabel = stockMovementSourceLabel;

  protected readonly totalMovements = computed(() => this.summary()?.totalMovements ?? 0);
  protected readonly inboundMovements = computed(() => this.summary()?.inboundMovements ?? 0);
  protected readonly outboundMovements = computed(() => this.summary()?.outboundMovements ?? 0);
  protected readonly adjustmenMovements = computed(() => this.summary()?.adjustmentMovements ?? 0);
  protected readonly lossMovements = computed(() => this.summary()?.lossMovements ?? 0);

  protected readonly canCreateMovement = computed(
    () =>
      this.session.hasPermission('inventory:create') && this.session.hasPermission('products:read'),
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadMovements();
  }

  protected loadMovements() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.listRequest = this.inventoryService
      .getMovements({
        page: this.pageIndex(),
        size: this.pageSize(),
        sort: 'movementDateTime,desc',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.movements.set(page.content);
          this.totalElements.set(page.totalElements);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar los movimientos de inventario.');
          this.loading.set(false);
        },
      });
  }

  protected loadSummary() {
    this.summaryRequest?.unsubscribe();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryRequest = this.inventoryService
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

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadMovements();
  }

  protected movementDelta(movement: StockMovement) {
    const delta = movement.newStock - movement.previousStock;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  protected showReason(movement: StockMovement) {
    if (!movement.reason?.trim()) return;
    this.selectedMovement.set(movement);
    this.dialog.open(this.reasonDialog(), {
      width: '640px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
      ariaLabel: 'Motivo del movimiento',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
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
