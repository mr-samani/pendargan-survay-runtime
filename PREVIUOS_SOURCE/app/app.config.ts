import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { NgxCaptchaModule } from 'ngx-captcha';
import { BidiModule } from '@angular/cdk/bidi';
import { ToastrModule } from 'ngx-toastr';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { SharedModule } from './shared/shared.module';
import { NgxAlertModalModule } from 'ngx-alert-modal';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClientInterceptor } from './http.interceptor';
import { CookieService } from './vote/services/cookie.service';
import { iniitlizeApp } from './initialize-app';
import { OtelHttpInterceptor } from '../open-telemtry/interceptor';
import { MyErrorHandler } from '../open-telemtry/error-handler';
import { ApmErrorHandler, ApmModule } from '@elastic/apm-rum-angular';
declare const browser: any;
export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(iniitlizeApp),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'fa',
        loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
      }),
      NgxCaptchaModule,
      BidiModule,
      ToastrModule.forRoot({
        timeOut: 6000,
        positionClass: 'toast-bottom-center',
        preventDuplicates: true,
        closeButton: true,
        progressBar: true,
      }),

      MaterialCommonModule,
      SharedModule,
      NgxAlertModalModule.forRoot({
        useOverlay: browser?.versionNumber > 114 ? true : false,
      }),
      ApmModule,
    ),

    // ErrorHandler,
    { provide: ErrorHandler, useClass: MyErrorHandler },
    { provide: ErrorHandler, useClass: ApmErrorHandler },
    { provide: HTTP_INTERCEPTORS, useClass: OtelHttpInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: HttpClientInterceptor, multi: true, deps: [CookieService] },
  ],
};
