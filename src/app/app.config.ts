import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { apiUrlInterceptor } from './core/interceptors/api-url.interceptor';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { xsrfInterceptor } from './core/interceptors/xsrf.interceptor';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';
import { spanishPaginatorIntl } from './core/i18n/spanish-paginator-intl';

registerLocaleData(localeEsCo);

const COLOMBIAN_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'dd/MM/yyyy',
    monthYearLabel: 'MMMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    provideHttpClient(
      withInterceptors([
        apiUrlInterceptor,
        credentialsInterceptor,
        xsrfInterceptor,
        authRefreshInterceptor,
      ]),
    ),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: MAT_DATE_FORMATS, useValue: COLOMBIAN_DATE_FORMATS },
    { provide: MatPaginatorIntl, useFactory: spanishPaginatorIntl },
  ],
};
