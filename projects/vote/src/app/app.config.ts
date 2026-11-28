import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AppInitializer } from '@core/AppInitializer';
import { AppConsts } from '@core/models/app-consts';
import { API_BASE_URL } from '@service-proxies/core/api-config';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { httpInterceptor } from '@core/interceptors/http-interceptor';
import { provideMessage } from 'ngx-kit/message';
import { provideNotify } from 'ngx-kit/notify';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(AppInitializer),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpInterceptor])),
    provideMessage(),
    provideNotify(),
    { provide: API_BASE_URL, useFactory: () => AppConsts.apiBaseUrl },
  ],
};
