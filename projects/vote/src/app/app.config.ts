import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
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
import { PAYMENT_SIGNALR_CONNECTOR, PAYMENT_SIGNALR_OPTIONS } from './runtime/payment/payment-signalr-connector';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(AppInitializer),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpInterceptor])),
    provideMessage(),
    provideNotify(),
    {
      provide: PAYMENT_SIGNALR_CONNECTOR,
      useFactory: () => {
        const options = inject(PAYMENT_SIGNALR_OPTIONS);
        return {
          connect: async (url: string) => {
            const { MicrosoftPaymentSignalRConnector } = await import('./runtime/payment/payment-signalr-connector.impl');
            return new MicrosoftPaymentSignalRConnector(options).connect(url);
          },
        };
      },
    },
    { provide: API_BASE_URL, useFactory: () => AppConsts.apiBaseUrl },
  ],
};
