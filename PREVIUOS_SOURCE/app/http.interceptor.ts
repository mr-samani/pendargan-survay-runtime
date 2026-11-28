import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { CookieService } from './vote/services/cookie.service';
import { AppConsts } from '@core/app-consts';

@Injectable()
export class HttpClientInterceptor implements HttpInterceptor {
  tokenCookieName = 'Abp.AuthToken';
  tenantIdCookieName = 'Abp.TenantId';
  constructor(private cookieService: CookieService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(this.addToken(request)).pipe(
      catchError((error: HttpErrorResponse) => {
        // console.log('ServerErrorInterceptor ⚔️:', error);
        return throwError(() => error);
      }),
      switchMap((response) => {
        return this.handleResponse(response);
      }),
    );
  }

  addToken(req: HttpRequest<any>): HttpRequest<any> {
    const accessToken = this.cookieService.get(this.tokenCookieName);
    const tenantId = this.cookieService.get(this.tenantIdCookieName);
    let previousPollIds = localStorage.getItem('_ga2') || '';
    let modifiedHeaders = req.headers;
    if (AppConsts.tenancyName) {
      modifiedHeaders = modifiedHeaders.set('Tenancy-Name', AppConsts.tenancyName);
    }
    if (tenantId) {
      modifiedHeaders = modifiedHeaders.set('abp.tenantid', tenantId);
    }
    if (previousPollIds) {
      modifiedHeaders = modifiedHeaders.set('_ga2', previousPollIds);
    }
    // set content type
    if (
      !req.reportProgress &&
      (!modifiedHeaders.getAll('Content-Type') || modifiedHeaders.getAll('Content-Type')?.length === 0)
    ) {
      modifiedHeaders = modifiedHeaders.set('Content-Type', 'application/json');
    }

    // jwt token in header
    if (AppConsts.clientAuth) {
      modifiedHeaders = modifiedHeaders.set('Authorization', 'Bearer ' + accessToken);
      return req.clone({
        withCredentials: false,
        headers: modifiedHeaders,
      });
    }
    // auth with cookie
    else {
      return req.clone({
        withCredentials: true,
        headers: modifiedHeaders,
      });
    }
  }

  handleResponse(result: HttpEvent<any>): Observable<HttpEvent<any>> {
    if (result instanceof HttpResponse) {
      let response = result.body;
      if (response && (!response.__abp || response.success)) {
        return of(result);
      } else {
        // let translateService = this.injector.get(TranslateService);
        // translateService.get('AnErrorOccurredOnTheServer').subscribe(errMsg => {
        //   let title = (response.error && response.error.message) ? response.error.message : errMsg
        //   this.alert.show({
        //     title,
        //     text: (response.error && response.error.details) ? response.error.details : '',
        //     confirmButtonText: translateService.instant('Ok')
        //   });
        // });
        return throwError(() => result.body);
      }
    } else {
      return of(result);
    }
  }
}
