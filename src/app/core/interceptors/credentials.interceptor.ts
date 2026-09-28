import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../config/api.config';

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const isApiRequest = request.url.startsWith('/') || request.url.startsWith(API_BASE_URL);

  if (!isApiRequest) {
    return next(request);
  }

  return next(request.clone({ withCredentials: true }));
};