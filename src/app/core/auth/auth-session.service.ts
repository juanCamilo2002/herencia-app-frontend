import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, computed, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { AuthUser, LoginRequest } from '../../features/auth/data-access/auth.model';
import { AuthService } from '../../features/auth/data-access/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  private csrfReady = false;
  private refreshInFlight$: Observable<AuthUser> | null = null;
  private initializeInFlight$: Observable<AuthUser | null> | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly initialized = signal(false);
  readonly isAuthenticated = computed(() => this.user() != null);
  readonly permissions = computed(() => new Set(this.user()?.permissions ?? []));

  isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  initialize() {
    if (!this.isBrowser()) {
      return of(null);
    }

    if (this.initialized()) {
      return of(this.user());
    }

    if (this.initializeInFlight$) {
      return this.initializeInFlight$;
    }

    this.initializeInFlight$ = this.ensureCsrf().pipe(
      switchMap(() => this.authService.me()),
      map((response) => response.user),
      tap((user) => {
        this.user.set(user);
        this.initialized.set(true);
      }),
      catchError(() => {
        this.user.set(null);
        this.initialized.set(true);
        return of(null);
      }),
      finalize(() => {
        this.initializeInFlight$ = null;
      }),
      shareReplay(1),
    );

    return this.initializeInFlight$;
  }

  login(request: LoginRequest) {
    return this.ensureCsrf().pipe(
      switchMap(() => this.authService.login(request)),
      map((response) => response.user),
      tap((user) => {
        this.user.set(user);
        this.initialized.set(true);
      }),
    );
  }

  refresh() {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.ensureCsrf().pipe(
      switchMap(() => this.authService.refresh()),
      map((response) => response.user),
      tap((user) => {
        this.user.set(user);
        this.initialized.set(true);
      }),
      catchError((error) => {
        this.clear();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay(1),
    );

    return this.refreshInFlight$;
  }

  logout() {
    return this.ensureCsrf().pipe(
      switchMap(() => this.authService.logout()),
      catchError(() => of(void 0)),
      tap(() => this.clear()),
    );
  }

  clear() {
    this.user.set(null);
    this.initialized.set(true);
    this.csrfReady = false;
    this.initializeInFlight$ = null;
  }

  hasPermission(permission: string) {
    return this.permissions().has(permission);
  }

  private ensureCsrf() {
    if (!this.isBrowser()) {
      return of(void 0);
    }

    if (this.csrfReady) {
      return of(void 0);
    }

    return this.authService.getCsrf().pipe(
      tap(() => {
        this.csrfReady = true;
      }),
      map(() => void 0),
    );
  }
}
