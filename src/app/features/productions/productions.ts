import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { MetricCard } from '../../shared/components/metric-card/metric-card';
import { ToastService } from '../../shared/services/toast.service';
import {
  Production,
  ProductionProcessType,
  ProductionSummary,
  ProductionSupplyItem,
} from './data-access/production.model';
import { ProductionService } from './data-access/production.service';
import { ProductionDetailDialog } from './production-detail-dialog/production-detail-dialog';
import { ProductionFormDialog } from './production-form-dialog/production-form-dialog';

@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTableModule,
    MetricCard,
  ],
  selector: 'app-productions',
  styleUrl: './productions.scss',
  templateUrl: './productions.html',
})
export class Productions implements OnInit {
  private readonly productionService = inject(ProductionService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(AuthSessionService);

  protected readonly productions = signal<Production[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = signal<ProductionSummary | null>(null);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly totalElements = signal(0);

  protected readonly displayedColumns = [
    'productionDateTime',
    'processes',
    'outputs',
    'supplies',
    'losses',
    'registeredBy',
    'status',
    'actions',
  ];

  protected readonly totalProductions = computed(() => this.summary()?.totalProductions ?? 0);
  protected readonly outputUnits = computed(() => this.summary()?.outputUnits ?? 0);
  protected readonly consumedSupplies = computed(() => this.summary()?.consumedSupplies ?? 0);
  protected readonly lostSupplies = computed(() => this.summary()?.lostSupplies ?? 0);

  protected readonly canCreateProduction = computed(() =>
    this.session.hasPermission('productions:create') &&
    this.session.hasPermission('products:read') &&
    this.session.hasPermission('supplies:read')
  );

  ngOnInit(): void {
    this.loadSummary();
    this.loadProductions();
  }

  protected pageChanged(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadProductions();
  }

  protected openCreateProductionDialog() {
    const dialogRef = this.dialog.open(ProductionFormDialog, {
      autoFocus: false,
      restoreFocus: false,
      width: '980px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 32px)',
      panelClass: 'app-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.toast.success('Producción registrada correctamente.');
        this.loadSummary();
        this.loadProductions();
      }
    });
  }

  protected openDetailDialog(production: Production) {
    this.productionService.getProduction(production.id).subscribe({
      next: (detail) => {
        this.dialog.open(ProductionDetailDialog, {
          autoFocus: false,
          restoreFocus: false,
          width: '880px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100dvh - 32px)',
          panelClass: 'app-dialog-panel',
          data: { production: detail },
        });
      },
      error: () => {
        this.toast.error('No fue posible cargar el detalle de la producción.');
      },
    });
  }

  protected processLabel(type: ProductionProcessType) {
    switch (type) {
      case 'BOTTLING':
        return 'Embotellado';
      case 'LABELING':
        return 'Etiquetado';
      case 'PACKAGING':
        return 'Empaque';
      case 'OTHER':
        return 'Otro';
    }
  }

  protected outputsSummary(production: Production) {
    return production.outputs
      .map((item) => `${item.quantity} x ${item.productName}`)
      .join(', ');
  }

  protected consumedItems(production: Production) {
    return production.supplies.filter((item) => item.type === 'CONSUMED');
  }

  protected lossItems(production: Production) {
    return production.supplies.filter((item) => item.type === 'LOSS');
  }

  protected suppliesSummary(items: ProductionSupplyItem[]) {
    if (items.length === 0) {
      return 'Sin registros';
    }

    return items
      .map((item) => `${item.quantity} x ${item.supplyName}`)
      .join(', ');
  }

  protected statusLabel() {
    return 'Completada';
  }

  private loadProductions() {
    this.loading.set(true);
    this.error.set(null);

    this.productionService.getProductions({
      page: this.pageIndex(),
      size: this.pageSize(),
      sort: 'productionDateTime,desc',
    }).subscribe({
      next: (page) => {
        this.productions.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar las producciones.');
        this.loading.set(false);
      },
    });
  }

  private loadSummary() {
    this.productionService.getSummary().subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }
}