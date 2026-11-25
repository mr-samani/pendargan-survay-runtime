import { Observable, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  DYNAMIC_OPTION_AUTOCOMPLETE_ENDPOINT,
  DynamicDataApiResponse,
  DynamicDataHttpLoader,
  DynamicDataHttpTransport,
} from './dynamic-data-http-loader';

function createOption(identificationCode: number) {
  return {
    dynamicDataUniqueId: 'catalog-1',
    identificationCode,
    answerTitle: `Option ${identificationCode}`,
    ordering: identificationCode,
  };
}

describe('DynamicDataHttpLoader', () => {
  it('uses the verified legacy endpoint and exact autocomplete payload', () => {
    const post = vi.fn((_url: string, _body: unknown) =>
      of<DynamicDataApiResponse>({
        result: { questionJsonDataList: [createOption(7)], totalCount: 1 },
      }),
    );
    const loader = new DynamicDataHttpLoader(
      { post } as unknown as DynamicDataHttpTransport,
      'https://api.example.test/',
    );

    expect(loader.search({
      instanceId: 'root',
      questionId: 'question-1',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
      fieldValueFilter: 'Q2.Data.City == 10',
      searchText: 'Tehran',
    })).toBe(true);

    expect(post).toHaveBeenCalledWith(
      `https://api.example.test${DYNAMIC_OPTION_AUTOCOMPLETE_ENDPOINT}`,
      expect.objectContaining({
        dynamicDataUniqueId: 'catalog-1',
        fieldToSearchIn: 'DynamicExpression',
        fieldValueFilter: 'Q2.Data.City == 10',
        searchText: 'Tehran',
        resultsNumber: 500,
        formGuid: 'form-1',
        searchWithoutSpace: true,
        recordIdArrayToGet: undefined,
      }),
    );
    expect(loader.getState('root', 'question-1').data?.options).toEqual([createOption(7)]);
  });

  it('keeps results isolated by repeated answer instance and rejects inactive requests', () => {
    const rootRequest = new Subject<DynamicDataApiResponse>();
    const loopRequest = new Subject<DynamicDataApiResponse>();
    const post = vi.fn()
      .mockReturnValueOnce(rootRequest)
      .mockReturnValueOnce(loopRequest);
    const loader = new DynamicDataHttpLoader(
      { post } as unknown as DynamicDataHttpTransport,
      '/api',
    );

    loader.search({
      instanceId: 'root',
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
    });
    loader.activateInstance('loop:section:0');
    expect(loader.search({
      instanceId: 'root',
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
    })).toBe(false);

    loader.search({
      instanceId: 'loop:section:0',
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
    });
    loopRequest.next({ result: { questionJsonDataList: [createOption(20)], totalCount: 1 } });
    rootRequest.next({ result: { questionJsonDataList: [createOption(10)], totalCount: 1 } });

    expect(loader.getState('loop:section:0', 'dynamic-q').data?.options[0].identificationCode).toBe(20);
    expect(loader.getState('root', 'dynamic-q').data).toBeUndefined();
  });

  it('retains the last successful list when a refresh fails', () => {
    let call = 0;
    const transport: DynamicDataHttpTransport = {
      post: <TResponse>() => {
        call++;
        if (call === 1) {
          return of({
            result: { questionJsonDataList: [createOption(3)], totalCount: 1 },
          }) as Observable<TResponse>;
        }
        return new Observable<TResponse>((subscriber) => subscriber.error(new Error('offline')));
      },
    };
    const loader = new DynamicDataHttpLoader(transport, '/api');
    const context = {
      instanceId: 'root',
      questionId: 'q1',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
    };

    loader.search(context);
    loader.search(context);

    const state = loader.getState('root', 'q1');
    expect(state.status).toBe('error');
    expect(state.data?.options[0].identificationCode).toBe(3);
  });

  it('builds initial SKU requests from secondary-filter record IDs', () => {
    const post = vi.fn(() => of({ result: { questionJsonDataList: [], totalCount: 0 } }));
    const loader = new DynamicDataHttpLoader(
      { post } as unknown as DynamicDataHttpTransport,
      '/api',
    );

    loader.loadSkuInitialList({
      instanceId: 'root',
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog-1',
      formGuid: 'form-1',
      secondaryFieldValueFilter: '12، 14, 18',
    });

    expect(post.mock.calls[0][1]).toEqual(expect.objectContaining({
      fieldToSearchIn: '',
      fieldValueFilter: '',
      searchText: '',
      recordIdArrayToGet: ['12', '14', '18'],
    }));
  });
});
