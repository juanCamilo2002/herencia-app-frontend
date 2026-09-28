import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { strongPasswordValidator } from '../../../shared/validators/password.validator';
import { AuthService } from '../data-access/auth.service';

@Component({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  selector: 'app-reset-password',
  styleUrl: './reset-password.scss',
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: samePasswordValidator,
    },
  );

  protected submit() {
    if (!this.token) {
      this.error.set('El enlace de recuperación no es válido.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.authService.confirmPasswordReset({
      token: this.token,
      password: this.form.controls.password.value,
    }).subscribe({
      next: () => {
        this.completed.set(true);
        this.saving.set(false);
        setTimeout(() => this.router.navigateByUrl('/login'), 1200);
      },
      error: () => {
        this.error.set('El enlace expiró o la contraseña no cumple los requisitos.');
        this.saving.set(false);
      },
    });
  }

  protected togglePasswordVisibility() {
    this.hidePassword.update((value) => !value);
  }

  protected toggleConfirmPasswordVisibility() {
    this.hideConfirmPassword.update((value) => !value);
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected hasFormError(errorName: string) {
    return this.form.touched && this.form.hasError(errorName);
  }
}

function samePasswordValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}
