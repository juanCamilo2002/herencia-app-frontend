import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../../shared/services/toast.service';
import { Supply } from '../../supplies/data-access/supply.model';
import { SupplyService } from '../../supplies/data-access/supply.service';
import { CreateSupplyMovementRequest, SupplyMovementType } from '../data-access/supply-inventory.model';
import { SupplyInventoryService } from '../data-access/supply-inventory.service';
import { supplyUnitLabel } from '../../supplies/data-access/supply-labels';

@Component({
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter()],
  selector: 'app-supply-movement-dialog',
  styleUrl: './supply-movement-dialog.scss',
  templateUrl: './supply-movement-dialog.html',
})
export class SupplyMovementDialog implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly supplyInventoryService = inject(SupplyInventoryService);
  private readonly supplyService = inject(SupplyService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<SupplyMovementDialog>);

  protected readonly supplies = signal<Supply[]>([]);
  protected readonly loadingSupplies = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly unitLabel = supplyUnitLabel;

  protected readonly form = this.formBuilder.nonNullable.group({
    supplyId: ['', [Validators.required]],
    type: ['INBOUND' as SupplyMovementType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0)]],
    movementDate: this.formBuilder.control<Date | null>(new Date(), [Validators.required]),
    movementTime: this.formBuilder.nonNullable.control(this.currentTimeOption(), [Validators.required]),
    reason: ['', [Validators.maxLength(255)]],
  });

  protected readonly timeOptions = this.createTimeOptions();

  protected readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  protected readonly selectedSupplyId = toSignal(this.form.controls.supplyId.valueChanges, {
    initialValue: this.form.controls.supplyId.value,
  });

  protected readonly selectedQuantity = toSignal(this.form.controls.quantity.valueChanges, {
    initialValue: this.form.controls.quantity.value,
  });

  protected readonly selectedSupply = computed(() =>
    this.supplies().find((supply) => supply.id === this.selectedSupplyId()) ?? null
  );

  protected readonly selectedReason = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: this.form.controls.reason.value,
  });

  protected readonly movementValidationError = computed(() => {
    const type = this.selectedType();
    const supply = this.selectedSupply();
    const quantity = this.selectedQuantity();

    if (quantity == null) {
      return null;
    }

    if ((type === 'INBOUND' || type === 'OUTBOUND') && quantity <= 0) {
      return 'Para entradas y salidas la cantidad debe ser mayor a 0.';
    }

    if (type === 'ADJUSTMENT' && quantity < 0) {
      return 'El stock final no puede ser negativo.';
    }

    if ((type === 'OUTBOUND' || type == 'LOSS') && supply && quantity > supply.stock) {
      return `Stock insuficiente. Disponible: ${supply.stock}`;
    }

    if (type === 'LOSS' && !this.selectedReason().trim()) {
      return 'El motivo es obligatorio para registrar una merma o pérdida.';
    }

    return null;
  });

  protected readonly projectedStock = computed(() => {
    const type = this.selectedType();
    const supply = this.selectedSupply();
    const quantity = this.selectedQuantity();

    if (!supply || quantity == null || quantity < 0) {
      return null;
    }

    switch (type) {
      case 'INBOUND':
        return supply.stock + quantity;
      case 'OUTBOUND':
      case 'LOSS':
        return supply.stock - quantity;
      case 'ADJUSTMENT':
        return quantity;
    }
  });

  ngOnInit(): void {
    this.loadSupplies();
  }

  protected close() {
    this.dialogRef.close(false);
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const validationError = this.movementValidationError();

    if (validationError) {
      this.form.controls.quantity.markAllAsTouched();
      this.error.set(validationError);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();

    const request: CreateSupplyMovementRequest = {
      supplyId: value.supplyId,
      type: value.type,
      quantity: value.quantity,
      movementDateTime: this.toMovementDateTime(value.movementDate, value.movementTime),
      reason: this.toNullableString(value.reason),
    };

    this.supplyInventoryService.createMovement(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveMovementError(error);
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected quantityLabel() {
    return this.selectedType() === 'ADJUSTMENT' ? 'Stock final' : 'Cantidad';
  }

  protected quantityHint() {
    switch (this.selectedType()) {
      case 'INBOUND':
        return 'Cantidad que ingresa al inventario.';
      case 'OUTBOUND':
        return 'Cantidad que sale del inventario.';
      case 'ADJUSTMENT':
        return 'Stock final que debe quedar para el insumo.';
      case 'LOSS':
        return 'Cantidad perdida, dañada o no utilizable.';
    }
  }



  private loadSupplies() {
    this.loadingSupplies.set(true);

    this.supplyService.getSupplyOptions().subscribe({
      next: (supplies) => {
        this.supplies.set(supplies);
        this.loadingSupplies.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los insumos.');
        this.loadingSupplies.set(false);
      },
    });
  }

  private resolveMovementError(error: unknown) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    switch (message) {
      case 'Insufficient stock':
        return 'No hay stock suficiente para registrar la salida.';
      case 'Quantity must be greater than zero':
        return 'La cantidad debe ser mayor a 0.';
      case 'Supply is inactive':
        return 'El insumo seleccionado está inactivo.';
      case 'Supply not found':
        return 'El insumo seleccionado no existe.';
      default:
        return 'No fue posible registrar el movimiento.';
    }
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private currentTimeOption() {
    const now = new Date();
    const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;

    return `${now.getHours().toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
  }

  private createTimeOptions() {
    const options: string[] = [];

    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }

    return options;
  }

  private toMovementDateTime(date: Date | null, time: string) {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${time}`;
  }
}