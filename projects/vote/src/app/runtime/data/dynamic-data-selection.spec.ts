import { describe, expect, it } from 'vitest';
import {
  findRestorableDynamicAnswer,
  mergeDynamicSkuOptions,
  type DynamicSkuSelection,
} from './dynamic-data-selection';

interface Option {
  identificationCode: string | number;
  answerTitle: string;
  ordering: number;
  dynamicDataUniqueId?: string;
  quantity?: number;
  total?: number | null;
  history?: readonly number[];
}

describe('dynamic data selection reconciliation', () => {
  it('restores a DynamicAnswer selection by record identity, not display title', () => {
    const previous = { identificationCode: 42, answerTitle: 'Old title' };
    const refreshed = [
      { identificationCode: '42', answerTitle: 'Renamed title' },
      { identificationCode: 43, answerTitle: 'Old title' },
    ];

    expect(findRestorableDynamicAnswer(previous, refreshed)).toBe(refreshed[0]);
    expect(findRestorableDynamicAnswer(previous, [refreshed[1]])).toBeUndefined();
    expect(findRestorableDynamicAnswer(undefined, refreshed)).toBeUndefined();
  });

  it('merges SKU options once while preserving selected rows and restoring saved totals', () => {
    const selected: Option[] = [{
      identificationCode: 'sku-1',
      answerTitle: 'Existing',
      ordering: 20,
      quantity: 3,
      total: 11,
      history: [1, 2],
    }];
    const fetched: Option[] = [
      { identificationCode: 'sku-1', answerTitle: 'Updated title', ordering: 20 },
      { identificationCode: 'sku-2', answerTitle: 'New', ordering: 10 },
      { identificationCode: 'sku-3', answerTitle: 'No saved total', ordering: 30 },
    ];
    const answers: DynamicSkuSelection[] = [
      { identificationCode: 'sku-1', total: 14 },
      { identificationCode: 'sku-2', total: 5 },
    ];

    const result = mergeDynamicSkuOptions(selected, fetched, answers, {
      dynamicDataUniqueId: 'catalog',
      showAdvanceButtons: true,
    });

    expect(result.map((item) => item.identificationCode)).toEqual(['sku-2', 'sku-1', 'sku-3']);
    expect(result[0]).toMatchObject({
      identificationCode: 'sku-2',
      quantity: 1,
      total: 5,
      history: [],
      dynamicDataUniqueId: 'catalog',
    });
    expect(result[1]).toMatchObject({
      identificationCode: 'sku-1',
      answerTitle: 'Updated title',
      quantity: 3,
      total: 14,
      history: [1, 2],
    });
    expect(result[2]).toMatchObject({
      identificationCode: 'sku-3',
      quantity: 1,
      total: 0,
      history: [],
    });
    expect(selected[0].total).toBe(11);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not turn a saved null SKU total into zero during reconciliation', () => {
    const selected: Option[] = [{
      identificationCode: 'sku-null',
      answerTitle: 'Existing null',
      ordering: 1,
      quantity: 1,
      total: null,
      history: [],
    }];
    const result = mergeDynamicSkuOptions<Option>(
      selected,
      [{ identificationCode: 'sku-null', answerTitle: 'Refreshed', ordering: 1 }],
      [{ identificationCode: 'sku-null', total: null }],
      { dynamicDataUniqueId: 'catalog', showAdvanceButtons: false },
    );

    expect(result[0].total).toBeNull();
  });

  it('uses null totals when advance buttons are disabled and keeps stable ties', () => {
    const result = mergeDynamicSkuOptions<Option>(
      [],
      [
        { identificationCode: 'a', answerTitle: 'A', ordering: 1 },
        { identificationCode: 'b', answerTitle: 'B', ordering: 1 },
        { identificationCode: 'c', answerTitle: 'C', ordering: 2 },
      ],
      [],
      { dynamicDataUniqueId: 'catalog', showAdvanceButtons: false },
    );

    expect(result.map((item) => item.identificationCode)).toEqual(['a', 'b', 'c']);
    expect(result.map((item) => item.total)).toEqual([null, null, null]);
  });
});


describe('mergeDynamicSkuOptions immutability', () => {
  it('copies nested history arrays so refreshed runtime state cannot mutate the previous snapshot', () => {
    const history = [1, -1];
    const previous = [{
      identificationCode: 'sku-1',
      quantity: 1,
      total: 2,
      history,
      ordering: 1,
      dynamicDataUniqueId: 'catalog',
    }];
    const result = mergeDynamicSkuOptions(previous, [] as typeof previous, [] as { identificationCode: string; total: number }[], {
      dynamicDataUniqueId: 'catalog',
      showAdvanceButtons: true,
    });
    expect(result[0].history).toEqual([1, -1]);
    expect(result[0].history).not.toBe(history);
    expect(previous[0].history).toBe(history);
  });
});
