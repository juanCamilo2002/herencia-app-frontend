import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthSessionService } from '../auth/auth-session.service';

export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AuthSessionService);

  if (!session.isBrowser()) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !shouldTryRefresh(request.url)
      ) {
        return throwError(() => error);
      }

      return session.refresh().pipe(
        switchMap(() => next(request)),
        catchError((refreshError) => {
          session.clear();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function shouldTryRefresh(url: string) {
  const normalizedUrl = url.startsWith(API_BASE_URL)
    ? url.slice(API_BASE_URL.length)
    : url;

  return (
    !normalizedUrl.startsWith('/auth/login') &&
    !normalizedUrl.startsWith('/auth/refresh') &&
    !normalizedUrl.startsWith('/auth/csrf')
  );
}
