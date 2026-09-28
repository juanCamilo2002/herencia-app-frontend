import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../../shared/services/toast.service';
import { CreateSupplyRequest, Supply, SupplyUnit, UpdateSupplyRequest } from '../data-access/supply.model';
import { SupplyService } from '../data-access/supply.service';

export type SupplyFormDialogData = {
  supply?: Supply;
};

@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  selector: 'app-supply-form-dialog',
  styleUrl: './supply-form-dialog.scss',
  templateUrl: './supply-form-dialog.html',
})
export class SupplyFormDialog {
  private readonly formBuilder = inject(FormBuilder);
  private readonly supplyService = inject(SupplyService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<SupplyFormDialog>);
  private readonly data = inject<SupplyFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly supply = this.data?.supply ?? null;
  protected readonly isEdit = this.supply != null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly units: { value: SupplyUnit; label: string }[] = [
    { value: 'UNIT', label: 'Unidad' },
    { value: 'GRAM', label: 'Gramo' },
    { value: 'KILOGRAM', label: 'Kilogramo' },
    { value: 'MILLILITER', label: 'Mililitro' },
    { value: 'LITER', label: 'Litro' },
    { value: 'METER', label: 'Metro' },
    { value: 'PACKAGE', label: 'Paquete' },
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [this.supply?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    category: [this.supply?.category ?? '', [Validators.maxLength(120)]],
    unit: [this.supply?.unit ?? 'UNIT' as SupplyUnit, [Validators.required]],
    unitCost: [this.supply?.unitCost ?? 0, [Validators.required, Validators.min(0)]],
    stock: [this.supply?.stock ?? 0, [Validators.required, Validators.min(0)]],
    minimumStock: [this.supply?.minimumStock ?? 0, [Validators.required, Validators.min(0)]],
  });

  protected close() {
    this.dialogRef.close(false);
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    if (this.isEdit && this.supply) {
      this.updateSupply(this.supply.id);
      return;
    }

    this.createSupply();
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  private createSupply() {
    const value = this.form.getRawValue();

    const request: CreateSupplyRequest = {
      name: value.name.trim(),
      category: this.toNullableString(value.category),
      unit: value.unit,
      unitCost: value.unitCost,
      stock: value.stock,
      minimumStock: value.minimumStock,
    };

    this.supplyService.createSupply(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible crear el insumo.');
        this.toast.error('No fue posible crear el insumo.');
        this.saving.set(false);
      },
    });
  }

  private updateSupply(id: string) {
    const value = this.form.getRawValue();

    const request: UpdateSupplyRequest = {
      name: value.name.trim(),
      category: this.toNullableString(value.category),
      unit: value.unit,
      unitCost: value.unitCost,
      minimumStock: value.minimumStock,
      active: this.supply?.active ?? true,
    };

    this.supplyService.updateSupply(id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible actualizar el insumo.');
        this.toast.error('No fue posible actualizar el insumo.');
        this.saving.set(false);
      },
    });
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }
}