import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { API_BASE_URL } from '../config/api.config';

const MUTABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const xsrfInterceptor: HttpInterceptorFn = (request, next) => {
  const platformId = inject(PLATFORM_ID);
  const isApiRequest = request.url.startsWith('/') || request.url.startsWith(API_BASE_URL);

  if (!isPlatformBrowser(platformId) || !isApiRequest || !MUTABLE_METHODS.has(request.method)) {
    return next(request);
  }

  const token = getCookie('XSRF-TOKEN');

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        'X-XSRF-TOKEN': token,
      },
    }),
  );
};

function getCookie(name: string) {
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}