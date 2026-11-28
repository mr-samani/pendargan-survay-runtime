import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AngularDynamicDataHttpTransport } from './dynamic-data-angular-transport';

describe('AngularDynamicDataHttpTransport', () => {
  it('delegates requests to HttpClient without bypassing the app interceptor chain', () => {
    const response = { result: { questionJsonDataList: [], totalCount: 0 } };
    const post = vi.fn((_url: string, _body: unknown) => of(response));
    const transport = Object.create(AngularDynamicDataHttpTransport.prototype) as AngularDynamicDataHttpTransport;
    Object.defineProperty(transport, 'http', {
      value: { post } as unknown as HttpClient,
    });

    const body = {
      dynamicDataUniqueId: 'catalog-1',
      fieldToSearchIn: 'DynamicExpression' as const,
      fieldValueFilter: 'Region eq 10',
      searchText: 'Tehran',
      resultsNumber: 500 as const,
      formGuid: 'form-1',
      recordIdArrayToGet: undefined,
      searchWithoutSpace: true as const,
      secondaryFieldToSearchIn: undefined,
      secondaryFieldValueFilter: undefined,
    };

    let result: unknown;
    transport.post<typeof response>('/api/QuestionData/getDynamicOptionAutoCompleteV2', body)
      .subscribe((value) => result = value);

    expect(post).toHaveBeenCalledWith('/api/QuestionData/getDynamicOptionAutoCompleteV2', body);
    expect(result).toBe(response);
  });
});
