import { DatePipe, DecimalPipe } from '@angular/common';
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
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogClose } from '@angular/material/dialog';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ToastService } from '../../shared/services/toast.service';
import { SupplyInventorySummary, SupplyMovement } from './data-access/supply-inventory.model';
import { SupplyInventoryService } from './data-access/supply-inventory.service';
import { SupplyMovementDialog } from './supply-movement-dialog/supply-movement-dialog';
import { supplyUnitLabel } from '../supplies/data-access/supply-labels';
import {
  supplyMovementIcon,
  supplyMovementLabel,
  supplyMovementSourceLabel,
  supplyMovementTone,
} from './data-access/supply-inventory-labels';

@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatDialogClose,
    MatTableModule,
    MetricCard,
    StatusBadge,
  ],
  selector: 'app-supply-inventory',
  styleUrl: './supply-inventory.scss',
  templateUrl: './supply-inventory.html',
})
export class SupplyInventory implements OnInit {
  private readonly supplyInventoryService = inject(SupplyInventoryService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reasonDialog = viewChild.required<TemplateRef<unknown>>('reasonDialog');
  protected readonly selectedMovement = signal<SupplyMovement | null>(null);
  private listRequest?: Subscription;
  private summaryRequest?: Subscription;
  protected readonly summaryLoading = signal(true);
  protected readonly summaryError = signal<string | null>(null);

  protected readonly movements = signal<SupplyMovement[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<SupplyInventorySummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = [
    'movement',
    'supply',
    'quantity',
    'stock',
    'source',
    'reason',
    'movementDateTime',
  ];

  protected readonly unitLabel = supplyUnitLabel;
  protected readonly movementLabel = supplyMovementLabel;
  protected readonly movementIcon = supplyMovementIcon;
  protected readonly movementTone = supplyMovementTone;
  protected readonly sourceLabel = supplyMovementSourceLabel;

  protected readonly totalMovements = computed(() => this.summary()?.totalMovements ?? 0);
  protected readonly inboundMovements = computed(() => this.summary()?.inboundMovements ?? 0);
  protected readonly outboundMovements = computed(() => this.summary()?.outboundMovements ?? 0);
  protected readonly adjustmentMovements = computed(() => this.summary()?.adjustmentMovements ?? 0);
  protected readonly lossMovements = computed(() => this.summary()?.lossMovements ?? 0);

  protected readonly canCreateMovement = computed(
    () =>
      this.session.hasPermission('supply-inventory:create') &&
      this.session.hasPermission('supplies:read'),
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadMovements();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadMovements();
  }

  protected movementDelta(movement: SupplyMovement) {
    const delta = movement.newStock - movement.previousStock;
    return delta > 0 ? `+${delta}` : `${delta}`;
  }

  protected showReason(movement: SupplyMovement) {
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
    const dialogRef = this.dialog.open(SupplyMovementDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Movimiento de insumo registrado correctamente.');
        this.loadSummary();
        this.loadMovements();
      }
    });
  }

  protected loadMovements() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.listRequest = this.supplyInventoryService
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
          this.error.set('No fue posible cargar los movimientos de insumos.');
          this.loading.set(false);
        },
      });
  }

  protected loadSummary() {
    this.summaryRequest?.unsubscribe();
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryRequest = this.supplyInventoryService
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
}
