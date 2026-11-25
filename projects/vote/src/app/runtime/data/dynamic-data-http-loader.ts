import { Observable, map } from 'rxjs';
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
 *
 * This class deliberately depends on a tiny transport interface instead of
 * Angular HttpClient. The host can pass its authenticated DataService/HttpClient
 * adapter, while the runtime owns request cancellation, loop isolation and
 * response normalization.
 */
export class DynamicDataHttpLoader {
  private readonly registry = new DynamicDataRequestRegistry<DynamicDataList>();
  readonly stateChanges$ = this.registry.stateChanges$;

  constructor(
    private readonly transport: DynamicDataHttpTransport,
    private readonly apiBaseUrl: string,
  ) {}

  get activeAnswerInstanceId(): string {
    return this.registry.activeAnswerInstanceId;
  }

  activateInstance(instanceId: string): void {
    this.registry.activateInstance(instanceId);
  }

  getState(
    instanceId: string,
    questionId: string,
  ): DynamicDataRequestState<DynamicDataList> {
    return this.registry.getState(instanceId, questionId);
  }

  search(
    context: DynamicDataLoaderContext,
  ): boolean {
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
