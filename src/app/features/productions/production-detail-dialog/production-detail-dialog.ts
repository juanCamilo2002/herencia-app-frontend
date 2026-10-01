import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Production, ProductionSupplyItem } from '../data-access/production.model';
import { supplyUnitLabel } from '../../supplies/data-access/supply-labels';
import { productionProcessLabel } from '../data-access/production-labels';

export type ProductionDetailDialogData = {
  production: Production;
};

@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
  ],
  selector: 'app-production-detail-dialog',
  styleUrl: './production-detail-dialog.scss',
  templateUrl: './production-detail-dialog.html',
})
export class ProductionDetailDialog {
  private readonly dialogRef = inject(MatDialogRef<ProductionDetailDialog>);
  private readonly data = inject<ProductionDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly production = this.data.production;

  protected close() {
    this.dialogRef.close();
  }

  protected readonly processLabel = productionProcessLabel;
  protected readonly unitLabel = supplyUnitLabel;

  protected consumedItems() {
    return this.production.supplies.filter((item) => item.type === 'CONSUMED');
  }

  protected lossItems() {
    return this.production.supplies.filter((item) => item.type === 'LOSS');
  }

  protected itemTrackBy(_: number, item: ProductionSupplyItem) {
    return item.id;
  }
}