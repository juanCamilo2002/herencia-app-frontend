import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ToastService } from '../../../shared/services/toast.service';
import { strongPasswordValidator } from '../../../shared/validators/password.validator';
import { CreateUserRequest, UpdateUserRequest, User, UserRoleOption } from '../data-access/user.model';
import { UserService } from '../data-access/user.service';

export type UserFormDialogData = {
  user?: User;
};

@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  selector: 'app-user-form-dialog',
  styleUrl: './user-form-dialog.scss',
  templateUrl: './user-form-dialog.html',
})
export class UserFormDialog implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialog>);
  private readonly data = inject<UserFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly user = this.data?.user ?? null;
  protected readonly isEdit = this.user != null;
  protected readonly roles = signal<UserRoleOption[]>([]);
  protected readonly loadingRoles = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: [this.user?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    email: [this.user?.email ?? '', [Validators.required, Validators.email, Validators.maxLength(160)]],
    password: ['', this.isEdit ? [] : [Validators.required, strongPasswordValidator]],
    roleId: [this.user?.role.id ?? '', [Validators.required]],
    active: [this.user?.active ?? true],
  });

  ngOnInit(): void {
    this.loadRoles();
  }

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

    if (this.isEdit && this.user) {
      this.updateUser(this.user.id);
      return;
    }

    this.createUser();
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  private loadRoles() {
    this.loadingRoles.set(true);

    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los roles.');
        this.loadingRoles.set(false);
      },
    });
  }

  private createUser() {
    const value = this.form.getRawValue();

    const request: CreateUserRequest = {
      name: value.name.trim(),
      email: value.email.trim().toLowerCase(),
      password: value.password,
      roleId: value.roleId,
    };

    this.userService.createUser(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveUserError(error, 'No fue posible crear el usuario.');
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  private updateUser(id: string) {
    const value = this.form.getRawValue();

    const request: UpdateUserRequest = {
      name: value.name.trim(),
      email: value.email.trim().toLowerCase(),
      roleId: value.roleId,
      active: value.active,
    };

    this.userService.updateUser(id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveUserError(error, 'No fue posible actualizar el usuario.');
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  private resolveUserError(error: unknown, fallback: string) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    switch (message) {
      case 'User email already exists':
        return 'Ya existe un usuario con ese email.';
      case 'Role not found':
        return 'El rol seleccionado no existe o está inactivo.';
      case 'Cannot change your own role':
        return 'No puedes cambiar tu propio rol.';
      case 'Cannot disable your own user':
        return 'No puedes desactivar tu propio usuario.';
      case 'Weak password':
        return 'La contraseña debe tener mínimo 12 caracteres, mayúscula, minúscula, número y símbolo.';
      default:
        return fallback;
    }
  }
}
