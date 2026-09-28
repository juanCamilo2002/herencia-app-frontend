import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { APP_NAVIGATION_ITEMS } from '../../../core/navigation/app-navigation';


@Component({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink
  ],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.session.initialize().subscribe((user) => {
      if (user) {
        this.router.navigateByUrl(this.returnUrl());
      }
    });
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.session.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigateByUrl(this.returnUrl());
      },
      error: () => {
        this.error.set('Credenciales inválidas.');
        this.saving.set(false);
      },
    });
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected togglePasswordVisibility() {
    this.hidePassword.update((value) => !value);
  }

  private defaultRoute() {


    return APP_NAVIGATION_ITEMS.find((item) =>
      this.session.hasPermission(item.permission)
    )?.route ?? '/dashboard';
  }

  private returnUrl() {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');

    if (!value || !value.startsWith('/') || value.startsWith('//')) {
      return this.defaultRoute();
    }

    return value;
  }
}
