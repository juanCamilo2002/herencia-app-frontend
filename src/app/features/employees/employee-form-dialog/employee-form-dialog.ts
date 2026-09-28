import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from '../../../shared/services/toast.service';
import { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../data-access/employee.model';
import { EmployeeService } from '../data-access/employee.service';

export type EmployeeFormDialogData = {
  employee?: Employee;
};

@Component({
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  selector: 'app-employee-form-dialog',
  styleUrl: './employee-form-dialog.scss',
  templateUrl: './employee-form-dialog.html',
  providers: [provideNativeDateAdapter()],
})
export class EmployeeFormDialog {
  private readonly formBuilder = inject(FormBuilder);
  private readonly employeeService = inject(EmployeeService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<EmployeeFormDialog>);
  private readonly data = inject<EmployeeFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly employee = this.data?.employee ?? null;
  protected readonly isEdit = this.employee != null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control(this.employee?.name ?? '', [
      Validators.required,
      Validators.maxLength(160),
    ]),
    document: this.formBuilder.nonNullable.control(this.employee?.document ?? '', [
      Validators.maxLength(40),
    ]),
    phone: this.formBuilder.nonNullable.control(this.employee?.phone ?? '', [
      Validators.maxLength(40),
    ]),
    email: this.formBuilder.nonNullable.control(this.employee?.email ?? '', [
      Validators.email,
      Validators.maxLength(120),
    ]),
    position: this.formBuilder.nonNullable.control(this.employee?.position ?? '', [
      Validators.maxLength(120),
    ]),
    hireDate: this.formBuilder.control<Date | null>(this.toDate(this.employee?.hireDate ?? null)),
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

    if (this.isEdit && this.employee) {
      this.updateEmployee(this.employee.id);
      return;
    }

    this.createEmployee();
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  private createEmployee() {
    const request = this.employeeRequest();

    this.employeeService.createEmployee(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible crear el empleado.');
        this.toast.error('No fue posible crear el empleado.');
        this.saving.set(false);
      },
    });
  }

  private updateEmployee(id: string) {
    const request = this.employeeRequest();

    this.employeeService.updateEmployee(id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.error.set('No fue posible actualizar el empleado.');
        this.toast.error('No fue posible actualizar el empleado.');
        this.saving.set(false);
      },
    });
  }

  private employeeRequest(): CreateEmployeeRequest | UpdateEmployeeRequest {
    const value = this.form.getRawValue();

    return {
      name: value.name.trim(),
      document: this.toNullableString(value.document),
      phone: this.toNullableString(value.phone),
      email: this.toNullableString(value.email),
      position: this.toNullableString(value.position),
      hireDate: this.toDateString(value.hireDate),
    };
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private toDate(value: string | null) {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toDateString(value: Date | null) {
    if (!value) {
      return null;
    }

    const year = value.getFullYear();
    const month = (value.getMonth() + 1).toString().padStart(2, '0');
    const day = value.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}