import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from '../../../shared/services/toast.service';
import { CreateCustomerRequest, Customer, UpdateCustomerRequest } from '../data-access/customer.model';
import { CustomerService } from '../data-access/customer.service';

export type CustomerFormDialogData = {
  customer?: Customer;
};

@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  selector: 'app-customer-form-dialog',
  styleUrl: './customer-form-dialog.scss',
  templateUrl: './customer-form-dialog.html',
})
export class CustomerFormDialog {
  private readonly formBuilder = inject(FormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<CustomerFormDialog>);
  private readonly data = inject<CustomerFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly customer = this.data?.customer ?? null;
  protected readonly isEdit = this.customer != null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [this.customer?.name ?? '', [Validators.required, Validators.maxLength(160)]],
    document: [this.customer?.document ?? '', [Validators.maxLength(40)]],
    phone: [this.customer?.phone ?? '', [Validators.maxLength(40)]],
    email: [this.customer?.email ?? '', [Validators.email, Validators.maxLength(120)]],
    address: [this.customer?.address ?? '', [Validators.maxLength(255)]],
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

    if (this.isEdit && this.customer) {
      this.updateCustomer(this.customer.id);
      return;
    }

    this.createCustomer();
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  private createCustomer() {
    const value = this.form.getRawValue();

    const request: CreateCustomerRequest = {
      name: value.name.trim(),
      document: this.toNullableString(value.document),
      phone: this.toNullableString(value.phone),
      email: this.toNullableString(value.email),
      address: this.toNullableString(value.address),
    };

    this.customerService.createCustomer(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible crear el cliente.');
        this.toast.error('No fue posible crear el cliente.');
        this.saving.set(false);
      },
    });
  }

  private updateCustomer(id: string) {
    const value = this.form.getRawValue();

    const request: UpdateCustomerRequest = {
      name: value.name.trim(),
      document: this.toNullableString(value.document),
      phone: this.toNullableString(value.phone),
      email: this.toNullableString(value.email),
      address: this.toNullableString(value.address),
      active: this.customer?.active ?? true,
    };

    this.customerService.updateCustomer(id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible actualizar el cliente.');
        this.toast.error('No fue posible actualizar el cliente.');
        this.saving.set(false);
      },
    });
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }
}