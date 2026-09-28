import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { switchMap } from 'rxjs';
import {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from './auth.model';



@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);

  getCsrf() {
    return this.http.get<void>('/auth/csrf');
  }

  login(request: LoginRequest) {
    return this.http.post<AuthResponse>('/auth/login', request);
  }

  refresh() {
    return this.http.post<AuthResponse>('/auth/refresh', {});
  }

  logout() {
    return this.http.post<void>('/auth/logout', {});
  }

  me() {
    return this.http.get<AuthResponse>('/auth/me');
  }

  requestPasswordReset(request: ForgotPasswordRequest) {
    return this.getCsrf().pipe(
      switchMap(() => this.http.post<void>('/auth/password-reset/request', request)),
    );
  }

  confirmPasswordReset(request: ResetPasswordRequest) {
    return this.getCsrf().pipe(
      switchMap(() => this.http.post<void>('/auth/password-reset/confirm', request)),
    );
  }
}