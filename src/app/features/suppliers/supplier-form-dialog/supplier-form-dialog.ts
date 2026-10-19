import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Supplier, SupplierRequest } from '../data-access/supplier.model';
import { SupplierService } from '../data-access/supplier.service';

export type SupplierFormDialogData = {
  supplier?: Supplier;
};

@Component({
  selector: 'app-supplier-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './supplier-form-dialog.html',
})
export class SupplierFormDialog {
  private readonly service = inject(SupplierService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<SupplierFormDialog>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly data = inject<SupplierFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  private readonly initialDisableClose = this.dialogRef.disableClose ?? false;

  protected readonly supplier = this.data?.supplier ?? null;
  protected readonly isEdit = this.supplier !== null;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [
      this.supplier?.name ?? '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)],
    ],
    document: [this.supplier?.document ?? '', Validators.maxLength(40)],
    phone: [this.supplier?.phone ?? '', Validators.maxLength(40)],
    email: [this.supplier?.email ?? '', [Validators.email, Validators.maxLength(120)]],
    address: [this.supplier?.address ?? '', Validators.maxLength(255)],
  });

  protected close() {
    if (!this.saving()) {
      this.dialogRef.close(false);
    }
  }

  protected submit() {
    if (this.saving()) {
      return;
    }

    const rawValue = this.form.getRawValue();

    const value = {
      name: rawValue.name.trim(),
      document: rawValue.document.trim(),
      phone: rawValue.phone.trim(),
      email: rawValue.email.trim(),
      address: rawValue.address.trim(),
    };

    this.form.setValue(value, { emitEvent: false });
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.focusFirstInvalidControl();
      return;
    }

    const request: SupplierRequest = {
      name: value.name,
      document: value.document || null,
      phone: value.phone || null,
      email: value.email || null,
      address: value.address || null,
    };

    this.error.set(null);
    this.setSaving(true);

    const operation = this.supplier
      ? this.service.updateSupplier(this.supplier.id, request)
      : this.service.createSupplier(request);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.setSaving(false);

        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.error.set('No tienes permiso para guardar este proveedor.');
          return;
        }

        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.error.set(
            'El proveedor ya no está disponible. Cierra el formulario y actualiza el listado.',
          );
          return;
        }

        this.error.set(
          'No fue posible guardar el proveedor. Tus datos se conservan para que puedas intentarlo de nuevo.',
        );
      },
    });
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];

    return control.touched && control.hasError(errorName);
  }

  private setSaving(saving: boolean) {
    this.saving.set(saving);

    this.dialogRef.disableClose = saving ? true : this.initialDisableClose;

    if (saving) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  private focusFirstInvalidControl() {
    afterNextRender(
      () => {
        this.elementRef.nativeElement
          .querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid')
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
