import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

import { AppConsts } from '@core/app-consts';
declare const browser: { platform: string; name: string; versionNumber: number };
@Injectable()
export class OtelHttpInterceptor implements HttpInterceptor {
  constructor(@Inject(DOCUMENT) private _document: Document) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (AppConsts.otl.active === false) {
      return next.handle(req);
    }
    const tracer = trace.getTracer('angular-vote-http-client');
    const span = tracer.startSpan(`Request: HTTP ${req.method} ${req.url}`, undefined, context.active());
    const startTime: Date = new Date();
    // add input
    let body = this.filterBody(req.body || {});
    span.setAttribute('http.requestBody', JSON.stringify(body));
    span.setAttribute('http.method', req.method);
    span.setAttribute('http.url', req.url);
    span.setAttribute('browser.user_agent', navigator.userAgent);
    span.setAttribute('browser.language', navigator.language);
    span.setAttribute('browser.online', navigator.onLine);
    span.setAttribute('browser.platform', browser?.platform);
    span.setAttribute('browser.name', browser?.name);
    span.setAttribute('browser.version', browser?.versionNumber);
    span.setAttribute('browser.url', this._document.location.href);
    span.setAttribute('tenantId', AppConsts.tenantId + '');
    span.setAttribute('tenancyName', AppConsts.tenancyName);

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          // add output to span
          if (event.type === 4) {
            // HttpResponse
            span.setAttribute('http.responseBody', JSON.stringify(event.body || {}));
            span.setAttribute('http.statusCode', event.status);
            span.setAttribute('http.statusText', event.statusText);
          }
        },
        error: (err) => {
          // add log to span
          span.recordException(err);
          span.setAttribute('http.response.body', JSON.stringify(err || {}));
          span.setAttribute('http.statusCode', err?.status);
          span.setAttribute('http.statusText', err?.statusText);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err?.message,
          });
          span.end();
        },
        complete: () => {
          //  span.setAttribute('http.cancelled', req.context.has('cancelled' as any) ? true : false);
          //close span
          span.setAttribute('http.load_time(second)', (new Date().valueOf() - startTime.valueOf()) / 1000);
          span.end();
        },
      }),
    );
  }

  private filterBody(body: any) {
    try {
      if (typeof body == 'string') {
        body = JSON.parse(body);
      }
      const exceptionList = ['password', 'secret', 'token'].map((m) => m.toLowerCase());

      const deepFilter = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(deepFilter);
        }

        if (obj !== null && typeof obj === 'object') {
          const result: any = {};
          for (const key of Object.keys(obj)) {
            if (exceptionList.includes(key.toLowerCase())) {
              result[key] = '[FILTERED]';
            } else {
              result[key] = deepFilter(obj[key]);
            }
          }
          return result;
        }
        return obj;
      };
      return deepFilter(body);
    } catch (error) {
      console.error(error);
      return {};
    }
  }
}
