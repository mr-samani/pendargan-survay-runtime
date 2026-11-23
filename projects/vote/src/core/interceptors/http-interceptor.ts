import {
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { AppConsts } from '../models/app-consts';
import { MSG } from 'ngx-kit/message';
import { inject } from '@angular/core';
import { CookieService } from '../services/cookie.service';
import { AuthService } from '../services/Auth.service';
import { catchError, map, tap, throwError } from 'rxjs';
import type { APIResult } from '../models/api.model';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('.json')) {
    return next(req);
  }
  if (!req.url.startsWith(AppConsts.apiBaseUrl)) {
    // console.log('NO withCredentials', req.url);
    return next(
      req.clone({
        withCredentials: false,
      }),
    );
  }
  const auth = inject(AuthService);
  var modifiedHeaders = new HttpHeaders();
  modifiedHeaders = addAspNetCoreCultureHeader(modifiedHeaders);

  // hanlde apis
  return next(
    req.clone({
      withCredentials: true,
      headers: modifiedHeaders,
    }),
  ).pipe(
    tap((event) => {
      if (event.type === HttpEventType.Response) {
        // console.log(req.url, 'returned a response with status', event.status);
      }
    }),
    map((event) => {
      if (event.type === HttpEventType.Response) {
        const data = event.body as APIResult;
        if (shouldParse(req) == false) {
          if (data.error) {
            throw new HttpErrorResponse({
              status: 200,
              error: data,
            });
          }
          return event.clone({
            body: data.result,
          });
        }

        if (data.success) {
          return event.clone({
            body: data.result,
          });
        }
        // error message showed by catcherror
        throw new HttpErrorResponse({
          status: 200,
          error: data,
        });
      }
      return event;
    }),
    catchError((err: HttpErrorResponse) => {
      switch (err.status) {
        case 401:
          handle401Request(req, auth, err);
          break;

        default:
          handleError(req, err);
          break;
      }
      return throwError(() => err.error);
    }),
  );
};

function shouldParse(req: HttpRequest<unknown>): boolean {
  const StandardApiExceptions = [
    AppConsts.apiBaseUrl + '/simple-captcha-endpoint.ashx',
    AppConsts.apiBaseUrl + '/File/',
  ];
  if (StandardApiExceptions.findIndex((x) => req.url.includes(x)) > -1) {
    return false;
  }
  return true;
}

function addAspNetCoreCultureHeader(headers: HttpHeaders): HttpHeaders {
  const cookie = inject(CookieService);
  let cookieLangValue = cookie.get('Abp.Localization.CultureName');
  if (cookieLangValue && headers) {
    headers = headers.set('lang', cookieLangValue);
  }

  return headers;
}

function handle401Request(req: HttpRequest<unknown>, auth: AuthService, err: HttpErrorResponse) {
  const apiError = err.error || {};
  const msg: string = apiError.error?.message ?? 'ErrorAccouredOnServer';
  MSG.error(msg);
  if (!req.url.includes('TokenAuth/Authenticate')) {
    auth.logout();
  }
}

function handleError(req: HttpRequest<unknown>, err: HttpErrorResponse) {
  console.log('rrr', req.url);
  const apiError = err.error || {};
  const msg: string = apiError.error?.message ?? 'ErrorAccouredOnServer';
  const details = apiError?.error?.details;
  MSG.error(msg, details);
}
