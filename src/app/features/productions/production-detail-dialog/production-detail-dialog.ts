import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  Production,
  ProductionProcessType,
  ProductionSupplyItem,
} from '../data-access/production.model';
import { SupplyUnit } from '../../supplies/data-access/supply.model';

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

  protected unitLabel(unit: SupplyUnit) {
    switch (unit) {
      case 'UNIT':
        return 'Unidad';
      case 'GRAM':
        return 'Gramo';
      case 'KILOGRAM':
        return 'Kilogramo';
      case 'MILLILITER':
        return 'Mililitro';
      case 'LITER':
        return 'Litro';
      case 'METER':
        return 'Metro';
      case 'PACKAGE':
        return 'Paquete';
    }
  }

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