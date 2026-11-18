import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AppInitializer } from '../core/AppInitializer';
import { AppConsts } from '../core/models/app-consts';
import { API_BASE_URL } from '@service-proxies/core/api-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(AppInitializer),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: API_BASE_URL, useFactory: () => AppConsts.apiBaseUrl },
  ],
};
