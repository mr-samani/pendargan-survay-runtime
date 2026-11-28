import { HttpClient } from '@angular/common/http';
import { InjectionToken, Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  DynamicDataHttpTransport,
} from './dynamic-data-http-loader';
import type { DynamicOptionAutocompleteRequest } from './dynamic-data-request';

/**
 * Production transport for the runtime's dynamic-data loader.
 *
 * Using HttpClient here is intentional: it preserves the application's
 * configured authentication/interceptor pipeline and makes unsubscribe abort
 * the underlying HTTP request.
 */
@Injectable({ providedIn: 'root' })
export class AngularDynamicDataHttpTransport implements DynamicDataHttpTransport {
  private readonly http = inject(HttpClient);

  post<TResponse>(url: string, body: DynamicOptionAutocompleteRequest): Observable<TResponse> {
    return this.http.post<TResponse>(url, body);
  }
}

export const DYNAMIC_DATA_HTTP_TRANSPORT = new InjectionToken<DynamicDataHttpTransport>(
  'DYNAMIC_DATA_HTTP_TRANSPORT',
  {
    providedIn: 'root',
    factory: () => inject(AngularDynamicDataHttpTransport),
  },
);
