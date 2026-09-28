import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../config/api.config';

export const apiUrlInterceptor: HttpInterceptorFn = (request, next) => {
    const isAbsoluteUrl = /^https?:\/\//i.test(request.url);
    const isApiRequest = request.url.startsWith('/');

    if (isAbsoluteUrl || !isApiRequest) {
        return next(request);
    }

    const apiRequest = request.clone({
        url: `${API_BASE_URL}${request.url}`,
    });

    return next(apiRequest)
}