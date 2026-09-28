import { Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

export type ConfirmDialogData = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: 'default' | 'danger';
}

@Component({
    imports: [MatButtonModule, MatDialogModule, MatIconModule],
    selector: 'app-confirm-dialog',
    styleUrl: './confirm-dialog.scss',
    templateUrl: './confirm-dialog.html'
})
export class ConfirmDialog {
    private readonly dialogRef = inject(MatDialogRef<ConfirmDialog>);
    protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

    protected readonly confirmText = this.data.confirmText ?? 'Confirmar';
    protected readonly cancelText = this.data.cancelText ?? 'Cancelar';
    protected readonly tone = this.data.tone ?? 'default';

    protected cancel() {
        this.dialogRef.close(false);
    }

    protected confirm() {
        this.dialogRef.close(true);
    }
}