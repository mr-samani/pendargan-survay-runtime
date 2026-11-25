import { Observable, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DynamicDataHttpLoader, type DynamicDataApiResponse, type DynamicDataHttpTransport } from './dynamic-data-http-loader';
import { DynamicDataRefreshCoordinator } from './dynamic-data-refresh-coordinator';
import { DynamicDataRendererController } from './dynamic-data-renderer-controller';

function createHarness(response: () => Observable<DynamicDataApiResponse> = () => of({
  result: {
    questionJsonDataList: [
      { dynamicDataUniqueId: 'catalog', identificationCode: 1, answerTitle: 'One', ordering: 1 },
      { dynamicDataUniqueId: 'catalog', identificationCode: 2, answerTitle: 'Two', ordering: 2 },
    ],
    totalCount: 2,
  },
})) {
  const post = vi.fn((_url: string, _body: unknown) => response());
  const loader = new DynamicDataHttpLoader(
    { post } as unknown as DynamicDataHttpTransport,
    '/api',
  );
  const coordinator = new DynamicDataRefreshCoordinator(loader);
  return { loader, coordinator, post };
}

describe('DynamicDataRendererController', () => {
  it('connects DynamicAnswer initialization, snapshot projection and identity-based selection', () => {
    const { loader, coordinator, post } = createHarness();
    const changed = vi.fn();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'root',
      registration: {
        questionId: 'dynamic-q',
        dynamicDataUniqueId: 'catalog',
        formGuid: 'form',
        mode: 'autocomplete',
      },
      reservedIdentificationCodes: [2],
      checkDuplicateOptionInSectionLoop: true,
      initialFieldValueFilter: 'Q1.Data.Region == 3',
    }, changed);
    const snapshots: any[] = [];
    controller.snapshot$.subscribe((snapshot) => snapshots.push(snapshot));

    expect(controller.initialize()).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      fieldValueFilter: 'Q1.Data.Region == 3',
      searchText: '',
    });
    expect(snapshots.at(-1).options[1].isSelectedInSectionLoop).toBe(true);
    expect(controller.selectAnswer(snapshots.at(-1).options[1])).toBe(false);
    expect(controller.selectAnswer(snapshots.at(-1).options[0])).toBe(true);
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ identificationCode: 1 }));
  });

  it('auto-selects first available record once after initial list load', () => {
    const { loader, coordinator } = createHarness();
    const changed = vi.fn();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'root',
      registration: {
        questionId: 'dynamic-q', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'autocomplete',
      },
      autoSelectFirstOption: true,
    }, changed);
    controller.snapshot$.subscribe();
    controller.initialize();

    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ identificationCode: 1 }));
  });

  it('keeps SKU secondary initial-list requests distinct from text autocomplete', () => {
    const { loader, coordinator, post } = createHarness();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'root',
      registration: {
        questionId: 'sku-q', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'sku-initial-list',
      },
      initialSecondaryFieldValueFilter: '1، 2',
      showAdvanceButtons: false,
    }, vi.fn());
    controller.snapshot$.subscribe();

    expect(controller.initialize()).toBe(true);
    expect(post.mock.calls[0][1]).toMatchObject({
      fieldToSearchIn: '',
      fieldValueFilter: '',
      searchText: '',
      recordIdArrayToGet: ['1', '2'],
    });
    expect(controller.addSku({
      dynamicDataUniqueId: 'catalog', identificationCode: 1, answerTitle: 'One', ordering: 1,
    })).toBe(false); // Initial-list rows are already present in the selected SKU collection.
    expect(controller.setSkuTotal(1, 0)).toBe(true);
    expect(controller.selectedSkuTotal).toBe(0);
    expect(controller.incrementSku(1)).toBe(true);
    expect(controller.decrementSku(1)).toBe(true);
    expect(controller.removeSku(1)).toBe(true);
  });

  it('searches within a repeated answer instance and refuses writes after another loop activates', () => {
    const { loader, coordinator, post } = createHarness();
    const changed = vi.fn();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'loop:section:1',
      registration: {
        questionId: 'dynamic-q', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'autocomplete',
      },
    }, changed);
    controller.snapshot$.subscribe();
    controller.initialize();
    expect(controller.search('second')).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);

    loader.activateInstance('loop:section:2');
    expect(controller.search('stale')).toBe(false);
    expect(controller.selectAnswer({
      dynamicDataUniqueId: 'catalog', identificationCode: 1, ordering: 1,
    })).toBe(false);
  });


  it('routes computed filters and SKU secondary filters through separate request contracts', () => {
    const { loader, coordinator, post } = createHarness();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'root',
      registration: {
        questionId: 'sku-q', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'sku-initial-list',
      },
    }, vi.fn());
    controller.snapshot$.subscribe();

    expect(controller.initialize()).toBe(true);
    expect(controller.refreshFilter('Q4.Data.Region == 8')).toBe(true);
    expect(controller.refreshSecondaryFilter('21، 22')).toBe(true);

    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls[1][1]).toMatchObject({
      fieldToSearchIn: 'DynamicExpression',
      fieldValueFilter: 'Q4.Data.Region == 8',
      recordIdArrayToGet: undefined,
    });
    expect(post.mock.calls[2][1]).toMatchObject({
      fieldToSearchIn: '',
      fieldValueFilter: '',
      recordIdArrayToGet: ['21', '22'],
    });
  });

  it('restores SKU totals and publishes the reconciled selected list when initial data arrives', () => {
    const request = new Subject<DynamicDataApiResponse>();
    const { loader, coordinator } = createHarness(() => request);
    const changed = vi.fn();
    const controller = new DynamicDataRendererController(loader, coordinator, {
      instanceId: 'root',
      registration: {
        questionId: 'sku-q', dynamicDataUniqueId: 'catalog', formGuid: 'form', mode: 'sku-initial-list',
      },
      initialSkuAnswers: [{
        identificationCode: 1, quantity: 4, total: 8, history: [2, 6],
      }],
      initialSecondaryFieldValueFilter: '1, 2',
      showAdvanceButtons: true,
    }, changed);
    controller.snapshot$.subscribe();
    controller.initialize();
    request.next({ result: {
      questionJsonDataList: [
        { dynamicDataUniqueId: 'catalog', identificationCode: 1, answerTitle: 'One', ordering: 1 },
        { dynamicDataUniqueId: 'catalog', identificationCode: 2, answerTitle: 'Two', ordering: 2 },
      ],
      totalCount: 2,
    } });

    expect(changed).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ identificationCode: 1, quantity: 4, total: 8, history: [2, 6] }),
      expect.objectContaining({ identificationCode: 2, quantity: 1, total: 0, history: [] }),
    ]));
  });
});
