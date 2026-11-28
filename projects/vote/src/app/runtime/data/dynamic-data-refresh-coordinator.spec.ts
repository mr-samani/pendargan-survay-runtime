import { Observable, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  DynamicDataHttpLoader,
  type DynamicDataApiResponse,
  type DynamicDataHttpTransport,
} from './dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from './dynamic-data-refresh-coordinator';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { DynamicOptionAutocompleteRequest } from './dynamic-data-request';

describe('DynamicDataRefreshCoordinator', () => {
  it('registers all supported dynamic question DTOs and skips other question types', () => {
    const { coordinator, post } = setup();
    const registrations = coordinator.registerQuestions([
      {
        uniqueIdPerForm: 'dynamic-q',
        questionType: FormQuestionTypesEnum.DynamicAnswer,
        dynamicDataUniqueId: 'catalog',
      },
      {
        uniqueIdPerForm: 'sku-q',
        questionType: FormQuestionTypesEnum.SkuCount_Dynamic,
        dynamicDataUniqueId: 'catalog',
      },
      {
        uniqueIdPerForm: 'ordinary-q',
        questionType: FormQuestionTypesEnum.UniqueSelect,
        dynamicDataUniqueId: 'catalog',
      },
    ], 'form');
    expect(registrations.map((item) => item.questionId)).toEqual(['dynamic-q', 'sku-q']);
    expect(coordinator.refresh({
      instanceId: 'root', questionId: 'dynamic-q', filterValue: 'A eq 1',
    }).status).toBe('requested');
    expect(coordinator.refreshSecondaryFilter({
      instanceId: 'root', questionId: 'sku-q', filterValue: '1,2',
    }).status).toBe('requested');
    expect(post).toHaveBeenCalledTimes(2);
  });


  function setup() {
    const post = vi.fn((_url: string, _body: unknown) => of<DynamicDataApiResponse>({
      result: { questionJsonDataList: [], totalCount: 0 },
    }));
    const loader = new DynamicDataHttpLoader(
      { post } as unknown as DynamicDataHttpTransport,
      '/api',
    );
    const coordinator = new DynamicDataRefreshCoordinator(loader);
    return { post, loader, coordinator };
  }

  it('requests a changed expression filter once and skips an unchanged value', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'autocomplete',
    });

    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'dynamic-q',
      filterValue: 'City eq 10',
    }).status).toBe('requested');
    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'dynamic-q',
      filterValue: 'City eq 10',
    }).status).toBe('unchanged');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      fieldToSearchIn: 'DynamicExpression',
      fieldValueFilter: 'City eq 10',
    });
  });

  it('uses autocomplete for a SKU expression filter, not the initial-list payload', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'sku-q',
      filterValue: 'Category eq 3',
    }).status).toBe('requested');
    expect(post.mock.calls[0][1]).toMatchObject({
      fieldToSearchIn: 'DynamicExpression',
      fieldValueFilter: 'Category eq 3',
      recordIdArrayToGet: undefined,
    });
  });

  it('replaces the previous request when the evaluated filter changes', () => {
    const requests: Subject<DynamicDataApiResponse>[] = [];
    const transport: DynamicDataHttpTransport = {
      post: <TResponse>() => {
        const request = new Subject<DynamicDataApiResponse>();
        requests.push(request);
        return request as unknown as Observable<TResponse>;
      },
    };
    const loader = new DynamicDataHttpLoader(transport, '/api');
    const coordinator = new DynamicDataRefreshCoordinator(loader);
    coordinator.register({
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'autocomplete',
    });

    coordinator.refresh({ instanceId: 'root', questionId: 'dynamic-q', filterValue: 'City eq 1' });
    coordinator.refresh({ instanceId: 'root', questionId: 'dynamic-q', filterValue: 'City eq 2' });
    requests[0].next({ result: { questionJsonDataList: [], totalCount: 1 } });
    requests[1].next({ result: { questionJsonDataList: [], totalCount: 2 } });

    expect(loader.getState('root', 'dynamic-q').data?.totalCount).toBe(2);
  });

  it('isolates secondary-filter caches between loop instances', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    const effect = [{
      questionId: 'sku-q',
      secondaryFieldValueFilter: '1,2',
      shouldTriggerDynamicFilter: true,
      shouldRecalculateAnswer: true,
    }] as const;
    coordinator.applyGlobalVariableEffects('root', effect);
    coordinator.activateInstance('loop:section:0');
    coordinator.applyGlobalVariableEffects('loop:section:0', effect);

    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][1] as DynamicOptionAutocompleteRequest).recordIdArrayToGet).toEqual(['1', '2']);
    expect((post.mock.calls[1][1] as DynamicOptionAutocompleteRequest).recordIdArrayToGet).toEqual(['1', '2']);
  });

  it('does not send unresolved placeholders to the API and cancels stale work', () => {
    const pending = new Subject<DynamicDataApiResponse>();
    const post = vi.fn((_url: string, _body: unknown) => pending);
    const loader = new DynamicDataHttpLoader(
      { post } as unknown as DynamicDataHttpTransport,
      '/api',
    );
    const coordinator = new DynamicDataRefreshCoordinator(loader);
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    coordinator.refreshSecondaryFilter({ instanceId: 'root', questionId: 'sku-q', filterValue: '1,2' });
    expect(coordinator.refreshSecondaryFilter({
      instanceId: 'root',
      questionId: 'sku-q',
      filterValue: 'region=[%Region%]',
    }).status).toBe('unresolved-filter');

    expect(post).toHaveBeenCalledTimes(1);
    expect(loader.getState('root', 'sku-q').status).toBe('idle');
  });

  it('uses distinct deduplication keys for expression and secondary filters', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    coordinator.refresh({ instanceId: 'root', questionId: 'sku-q', filterValue: '1,2' });
    coordinator.refreshSecondaryFilter({ instanceId: 'root', questionId: 'sku-q', filterValue: '1,2' });

    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][1] as DynamicOptionAutocompleteRequest).fieldToSearchIn).toBe('DynamicExpression');
    expect((post.mock.calls[1][1] as DynamicOptionAutocompleteRequest).recordIdArrayToGet).toEqual(['1', '2']);
  });

  it('adapts evaluated expression filters and global-variable secondary-filter effects', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'autocomplete',
    });
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    const resolved = coordinator.applyFilterResolution('root', [{
      expressionId: 'filter-1',
      questionId: 'dynamic-q',
      value: 'City eq 4',
    }]);
    expect(resolved[0].status).toBe('requested');

    const effects = coordinator.applyGlobalVariableEffects('root', [{
      questionId: 'sku-q',
      secondaryFieldValueFilter: '11،12',
      shouldTriggerDynamicFilter: true,
      shouldRecalculateAnswer: true,
    }]);
    expect(effects[0].status).toBe('requested');
    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][1] as DynamicOptionAutocompleteRequest).fieldValueFilter).toBe('City eq 4');
    expect((post.mock.calls[1][1] as DynamicOptionAutocompleteRequest).recordIdArrayToGet).toEqual(['11', '12']);
  });

  it('rejects updates from inactive instances and unregistered questions', () => {
    const { coordinator, post } = setup();
    coordinator.register({
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'autocomplete',
    });
    expect(coordinator.refresh({
      instanceId: 'loop:section:0',
      questionId: 'dynamic-q',
      filterValue: 'x',
    }).status).toBe('inactive-instance');
    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'missing',
      filterValue: 'x',
    }).status).toBe('unregistered');
    expect(post).not.toHaveBeenCalled();
  });

  it('does not use secondary-filter updates for non-SKU questions', () => {
    const { coordinator } = setup();
    coordinator.register({
      questionId: 'dynamic-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'autocomplete',
    });
    expect(coordinator.refreshSecondaryFilter({
      instanceId: 'root',
      questionId: 'dynamic-q',
      filterValue: '1,2',
    }).status).toBe('unsupported-mode');
  });

  it('removes only the requested question cache when unregistering', () => {
    const { post, coordinator } = setup();
    for (const questionId of ['q-1', 'q-2']) {
      coordinator.register({ questionId, dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'autocomplete' });
      coordinator.refresh({ instanceId: 'root', questionId, filterValue: 'same' });
    }
    coordinator.unregister('q-1');
    coordinator.register({ questionId: 'q-1', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'autocomplete' });
    expect(coordinator.refresh({ instanceId: 'root', questionId: 'q-1', filterValue: 'same' }).status).toBe('requested');
    expect(coordinator.refresh({ instanceId: 'root', questionId: 'q-2', filterValue: 'same' }).status).toBe('unchanged');
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('routes RetailAudit through the V2 expression autocomplete contract', () => {
    const { coordinator, post } = setup();
    const registrations = coordinator.registerQuestions([{
      uniqueIdPerForm: 'retail-q',
      questionType: FormQuestionTypesEnum.RetailAudit,
      dynamicDataUniqueId: 'retail-catalog',
    }], 'form-guid');

    expect(registrations).toHaveLength(1);
    expect(registrations[0].mode).toBe('retail-audit-autocomplete');
    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'retail-q',
      filterValue: 'StoreId eq 12',
    }).status).toBe('requested');
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0][0]).toBe('/api/QuestionData/getDynamicOptionAutoCompleteV2');
    expect(post.mock.calls[0][1]).toMatchObject({
      dynamicDataUniqueId: 'retail-catalog',
      formGuid: 'form-guid',
      fieldToSearchIn: 'DynamicExpression',
      fieldValueFilter: 'StoreId eq 12',
      searchText: '',
      resultsNumber: 500,
      recordIdArrayToGet: undefined,
      searchWithoutSpace: true,
    });
    expect(coordinator.refreshSecondaryFilter({
      instanceId: 'root', questionId: 'retail-q', filterValue: '1,2',
    }).status).toBe('unsupported-mode');
  });

});
