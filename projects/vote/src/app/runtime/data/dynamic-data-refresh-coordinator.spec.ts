import { Observable, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  DynamicDataHttpLoader,
  type DynamicDataApiResponse,
  type DynamicDataHttpTransport,
} from './dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from './dynamic-data-refresh-coordinator';
import type { DynamicOptionAutocompleteRequest } from './dynamic-data-request';

describe('DynamicDataRefreshCoordinator', () => {
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

  it('requests a changed evaluated filter once and skips an unchanged value', () => {
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

  it('isolates filter caches between loop instances', () => {
    const { post, coordinator } = setup();
    coordinator.register({
      questionId: 'sku-q',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form',
      mode: 'sku-initial-list',
    });

    coordinator.refresh({ instanceId: 'root', questionId: 'sku-q', filterValue: '1,2' });
    coordinator.activateInstance('loop:section:0');
    coordinator.refresh({ instanceId: 'loop:section:0', questionId: 'sku-q', filterValue: '1,2' });

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

    coordinator.refresh({ instanceId: 'root', questionId: 'sku-q', filterValue: '1,2' });
    expect(coordinator.refresh({
      instanceId: 'root',
      questionId: 'sku-q',
      filterValue: 'region=[%Region%]',
    }).status).toBe('unresolved-filter');

    expect(post).toHaveBeenCalledTimes(1);
    expect(loader.getState('root', 'sku-q').status).toBe('idle');
  });

  it('adapts evaluated filter resolutions and global-variable secondary-filter effects', () => {
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
});
