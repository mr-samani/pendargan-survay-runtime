import { Inject, Injectable, OnDestroy } from '@angular/core';
import { API_BASE_URL } from '@service-proxies/core/api-config';
import { Observable, map } from 'rxjs';
import { DYNAMIC_DATA_HTTP_TRANSPORT } from './dynamic-data-angular-transport';
import {
  DynamicDataRequestRegistry,
  DynamicDataRequestState,
} from './dynamic-data-request-registry';
import {
  createDynamicAutocompleteRequest,
  createDynamicSkuInitialListRequest,
  DynamicAutocompleteRequestContext,
  DynamicOptionAutocompleteRequest,
} from './dynamic-data-request';

export const DYNAMIC_OPTION_AUTOCOMPLETE_ENDPOINT =
  '/QuestionData/getDynamicOptionAutoCompleteV2';

export interface DynamicDataOption {
  readonly dynamicDataUniqueId: string;
  readonly identificationCode: string | number;
  readonly answerTitle?: string;
  readonly ordering: number;
  readonly jsonValuesDictionary?: Readonly<Record<string, string>>;
  readonly answerTitleLower?: string;
  readonly answerTitleLowerNoSpace?: string;
}

export interface DynamicDataList {
  readonly options: readonly DynamicDataOption[];
  readonly totalCount: number;
}

export interface DynamicDataApiResponse {
  readonly result?: {
    readonly questionJsonDataList?: readonly DynamicDataOption[] | null;
    readonly totalCount?: number | null;
  } | null;
}

export interface DynamicDataHttpTransport {
  post<TResponse>(url: string, body: DynamicOptionAutocompleteRequest): Observable<TResponse>;
}

export interface DynamicDataLoaderContext extends DynamicAutocompleteRequestContext {
  readonly instanceId: string;
  readonly questionId: string;
}

/**
 * HTTP boundary for legacy DynamicAnswer and SkuCount_Dynamic data.
 * The transport is injected so the production host uses its normal HttpClient
 * interceptors while tests can provide a deterministic observable transport.
 */
@Injectable({ providedIn: 'root' })
export class DynamicDataHttpLoader implements OnDestroy {
  private readonly registry = new DynamicDataRequestRegistry<DynamicDataList>();
  readonly stateChanges$ = this.registry.stateChanges$;

  constructor(
    @Inject(DYNAMIC_DATA_HTTP_TRANSPORT) private readonly transport: DynamicDataHttpTransport,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
  ) {}

  get activeAnswerInstanceId(): string {
    return this.registry.activeAnswerInstanceId;
  }

  activateInstance(instanceId: string): void {
    this.registry.activateInstance(instanceId);
  }

  getState(instanceId: string, questionId: string): DynamicDataRequestState<DynamicDataList> {
    return this.registry.getState(instanceId, questionId);
  }

  /**
   * Emits the current snapshot immediately, then only changes for this exact
   * answer-instance/question pair. Suitable for renderer AsyncPipe bindings;
   * switching loop instances requires subscribing with the new instance ID.
   */
  watch(
    instanceId: string,
    questionId: string,
  ): Observable<DynamicDataRequestState<DynamicDataList>> {
    return new Observable((subscriber) => {
      subscriber.next(this.getState(instanceId, questionId));
      const subscription = this.stateChanges$.subscribe(({ state }) => {
        if (state.instanceId === instanceId && state.questionId === questionId) {
          subscriber.next(state);
        }
      });
      return () => subscription.unsubscribe();
    });
  }

  search(context: DynamicDataLoaderContext): boolean {
    const request = createDynamicAutocompleteRequest(context);
    return this.load(context.instanceId, context.questionId, request);
  }

  loadSkuInitialList(
    context: Omit<DynamicDataLoaderContext, 'fieldValueFilter' | 'searchText'> & {
      readonly secondaryFieldValueFilter?: string | null;
    },
  ): boolean {
    const request = createDynamicSkuInitialListRequest(context);
    return this.load(context.instanceId, context.questionId, request);
  }

  cancel(instanceId: string, questionId: string): void {
    this.registry.cancel(instanceId, questionId);
  }

  dispose(): void {
    this.registry.dispose();
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  private load(
    instanceId: string,
    questionId: string,
    request: DynamicOptionAutocompleteRequest,
  ): boolean {
    const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
    const url = baseUrl + DYNAMIC_OPTION_AUTOCOMPLETE_ENDPOINT;
    return this.registry.request(instanceId, questionId, () =>
      this.transport.post<DynamicDataApiResponse>(url, request).pipe(
        map((response) => normalizeDynamicDataResponse(response)),
      ),
    );
  }
}

export function normalizeDynamicDataResponse(
  response: DynamicDataApiResponse | null | undefined,
): DynamicDataList {
  const options = response?.result?.questionJsonDataList ?? [];
  const totalCount = response?.result?.totalCount;
  return Object.freeze({
    options: Object.freeze(options.map((option) => Object.freeze({ ...option }))),
    totalCount: typeof totalCount === 'number' && Number.isFinite(totalCount)
      ? totalCount
      : options.length,
  });
}
