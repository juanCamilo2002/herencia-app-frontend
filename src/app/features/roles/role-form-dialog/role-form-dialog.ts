import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastService } from '../../../shared/services/toast.service';
import { CreateRoleRequest, Role, UpdateRoleRequest } from '../data-access/role.model';
import { RoleService } from '../data-access/role.service';

export type RoleFormDialogData = {
  role?: Role;
};

@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  selector: 'app-role-form-dialog',
  styleUrl: './role-form-dialog.scss',
  templateUrl: './role-form-dialog.html',
})
export class RoleFormDialog {
  private readonly formBuilder = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<RoleFormDialog>);
  private readonly data = inject<RoleFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly role = this.data?.role ?? null;
  protected readonly isEdit = this.role != null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);


  protected readonly activeToggleDisabled =
    this.role?.active === true && this.role.canDisable !== true;

  protected readonly form = this.formBuilder.nonNullable.group({
    code: [
      { value: this.role?.code ?? '', disabled: this.isEdit },
      [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    ],
    name: [this.role?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    description: [this.role?.description ?? '', [Validators.maxLength(255)]],
    active: [this.role?.active ?? true],
  });

  protected close() {
    this.dialogRef.close(false);
  }

  protected normalizeCode() {
    if (this.isEdit) {
      return;
    }

    const control = this.form.controls.code;
    const normalized = this.toRoleCode(control.value);

    if (control.value !== normalized) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  protected submit() {
    this.normalizeCode();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    if (this.isEdit && this.role) {
      this.updateRole(this.role.id);
      return;
    }

    this.createRole();
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected setActive(active: boolean) {
    this.form.controls.active.setValue(active);
    this.form.controls.active.markAsDirty();
  }

  private createRole() {
    const value = this.form.getRawValue();

    const request: CreateRoleRequest = {
      code: this.toRoleCode(value.code),
      name: value.name.trim(),
      description: this.toNullableString(value.description),
    };

    this.roleService.createRole(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveRoleError(error, 'No fue posible crear el rol.');
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  private updateRole(id: string) {
    const value = this.form.getRawValue();

    const request: UpdateRoleRequest = {
      name: value.name.trim(),
      description: this.toNullableString(value.description),
      active: value.active,
    };

    this.roleService.updateRole(id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveRoleError(error, 'No fue posible actualizar el rol.');
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  private toRoleCode(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private resolveRoleError(error: unknown, fallback: string) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    switch (message) {
      case 'Role code already exists':
        return 'Ya existe un rol con ese código.';
      case 'Invalid role code':
        return 'El código del rol no es válido.';
      case 'System role cannot be modified':
        return 'Los roles de sistema no pueden modificarse.';
      case 'Role has active users':
        return 'No puedes desactivar un rol con usuarios activos asignados.';
      default:
        return fallback;
    }
  }

}
