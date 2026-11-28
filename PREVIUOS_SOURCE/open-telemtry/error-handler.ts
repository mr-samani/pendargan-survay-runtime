
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Inject, Injectable, DOCUMENT } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { throwError } from 'rxjs/internal/observable/throwError';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { AppConsts } from '@core/app-consts';
declare const browser: { platform: string; name: string; versionNumber: number };

@Injectable()
export class MyErrorHandler implements ErrorHandler {
  constructor(@Inject(DOCUMENT) private _document: Document) {}

  handleError(error: Error | HttpErrorResponse): Observable<any> {
    if (AppConsts.otl.active === false) {
      return throwError(() => error);
    }
    let location = this._document.location.href;
    // console.log('Error catched 🔥: ', error, 'Url: ', location);
    const tracer = trace.getTracer('angular-vote-log-error');
    const span = tracer.startSpan(`🔥VOTE:Log Console Error`, undefined, context.active());
    span.setAttribute('error.name', error?.name);
    span.setAttribute('error.message', error?.message);

    span.setAttribute('browser.user_agent', navigator.userAgent);
    span.setAttribute('browser.language', navigator.language);
    span.setAttribute('browser.online', navigator.onLine);
    span.setAttribute('browser.platform', browser?.platform);
    span.setAttribute('browser.name', browser?.name);
    span.setAttribute('browser.version', browser?.versionNumber);
    span.setAttribute('browser.url', location);

    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error?.message,
    });
    span.end();
    return throwError(() => error);
  }
}
