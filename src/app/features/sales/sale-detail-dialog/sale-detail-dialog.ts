import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { Sale, SaleStatus } from "../data-access/sales.model";

@Component({
    imports: [
        CurrencyPipe,
        DatePipe,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatTableModule,
    ],
    selector: 'app-sale-detail-dialog',
    styleUrl: './sale-detail-dialog.scss',
    templateUrl: './sale-detail-dialog.html'
})
export class SaleDetailDialog {
    private readonly dialogRef = inject(MatDialogRef<SaleDetailDialog>);
    protected readonly sale = inject<Sale>(MAT_DIALOG_DATA);

    protected readonly displayedColumns = ['product', 'quantity', 'unitPrice', 'subtotal'];

    protected close() {
        this.dialogRef.close();
    }

    protected saleCode() {
        return this.sale.id.slice(0, 8).toUpperCase();
    }

    protected customerLabel() {
        return this.sale.customerName || 'Cliente general';
    }

    protected totalItems() {
        return this.sale.items.reduce((total, item) => total + item.quantity, 0);
    }

    protected statusLabel(status: SaleStatus) {
        switch (status) {
            case 'COMPLETED':
                return 'Completada';
        }
    }
}