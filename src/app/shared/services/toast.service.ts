import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export type ToastType = 'success' | 'error' | 'info';

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private readonly snackBar = inject(MatSnackBar);

    success(message: string) {
        this.open(message, 'success');
    }

    error(message: string) {
        this.open(message, 'error');
    }

    info(message: string) {
        this.open(message, 'info');
    }

    private open(message: string, type: ToastType) {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3500,
            horizontalPosition: 'right',
            verticalPosition: 'bottom',
            panelClass: [`toast-${type}`],
        });
    }
}