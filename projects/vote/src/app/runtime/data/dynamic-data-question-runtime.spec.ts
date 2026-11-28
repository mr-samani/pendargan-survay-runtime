import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import {
  addDynamicSku,
  addRetailAuditItem,
  removeRetailAuditItem,
  updateRetailAuditItemAnswers,
  validateRetailAuditSelection,
  createDynamicDataQuestionRegistration,
  decrementDynamicSku,
  incrementDynamicSku,
  reconcileDynamicAnswerOptions,
  reconcileDynamicSkuOptions,
  removeDynamicSku,
  setDynamicSkuTotal,
  sumDynamicSkuTotals,
  validateDynamicSkuSelection,
  type DynamicSkuItemState,
} from './dynamic-data-question-runtime';

describe('dynamic-data-question-runtime', () => {
  it('registers DynamicAnswer, SkuCount_Dynamic and RetailAudit from actual DTO identifiers', () => {
    expect(createDynamicDataQuestionRegistration({
      uniqueIdPerForm: 'dynamic-id',
      uniqueId: 'source-id',
      questionType: FormQuestionTypesEnum.DynamicAnswer,
      dynamicDataUniqueId: 'catalog',
    }, 'form-guid')).toEqual({
      questionId: 'dynamic-id',
      dynamicDataUniqueId: 'catalog',
      formGuid: 'form-guid',
      mode: 'autocomplete',
    });
    expect(createDynamicDataQuestionRegistration({
      uniqueIdPerForm: 'sku-id',
      questionType: FormQuestionTypesEnum.SkuCount_Dynamic,
      dynamicDataUniqueId: 'catalog',
    }, 'form-guid')?.mode).toBe('sku-initial-list');
    expect(createDynamicDataQuestionRegistration({
      uniqueIdPerForm: 'retail-id', questionType: FormQuestionTypesEnum.RetailAudit,
      dynamicDataUniqueId: 'retail-catalog',
    }, 'form-guid')).toEqual({ questionId: 'retail-id', dynamicDataUniqueId: 'retail-catalog', formGuid: 'form-guid', mode: 'retail-audit-autocomplete' });
  });

  it('ignores unsupported or incomplete DTOs instead of registering malformed requests', () => {
    expect(createDynamicDataQuestionRegistration({
      questionType: FormQuestionTypesEnum.UniqueSelect,
      dynamicDataUniqueId: 'catalog',
      uniqueId: 'q',
    }, 'form')).toBeUndefined();
    expect(createDynamicDataQuestionRegistration({
      questionType: FormQuestionTypesEnum.DynamicAnswer,
      uniqueId: 'q',
      dynamicDataUniqueId: 'catalog',
    }, '')).toBeUndefined();
  });

  it('restores DynamicAnswer by record identity and excludes duplicate earlier-loop choices', () => {
    const options = [
      { identificationCode: 1, answerTitle: 'One', ordering: 1, dynamicDataUniqueId: 'd' },
      { identificationCode: '2', answerTitle: 'Two', ordering: 2, dynamicDataUniqueId: 'd' },
    ];
    const restored = reconcileDynamicAnswerOptions(options, {
      identificationCode: '1', answerTitle: 'old', ordering: 1, dynamicDataUniqueId: 'd',
    }, ['2'], true);
    expect(restored.selection?.answerTitle).toBe('One');
    expect(restored.options[1].isSelectedInSectionLoop).toBe(true);
  });

  it('auto-selects the first non-reserved option only when there is no previous answer', () => {
    const result = reconcileDynamicAnswerOptions([
      { identificationCode: 1, ordering: 1, dynamicDataUniqueId: 'd' },
      { identificationCode: 2, ordering: 2, dynamicDataUniqueId: 'd' },
    ], undefined, [1], true);
    expect(result.selection?.identificationCode).toBe(2);
  });

  it('does not auto-select when a previous answer disappeared from refreshed options', () => {
    const result = reconcileDynamicAnswerOptions([
      { identificationCode: 2, ordering: 2, dynamicDataUniqueId: 'd' },
    ], { identificationCode: 1, ordering: 1, dynamicDataUniqueId: 'd' }, [], true);
    expect(result.selection).toBeUndefined();
  });

  it('merges refreshed SKU records without duplicating existing rows and restores saved totals', () => {
    type TestSku = {
      identificationCode: number;
      ordering: number;
      dynamicDataUniqueId: string;
      quantity?: number;
      total?: number | null;
      history?: readonly number[];
    };
    const selected: TestSku[] = [{
      identificationCode: 1, ordering: 2, quantity: 4, total: 8, history: [2, 6],
      dynamicDataUniqueId: 'd',
    }];
    const fetched: TestSku[] = [
      { identificationCode: 1, ordering: 2, dynamicDataUniqueId: 'd' },
      { identificationCode: 2, ordering: 1, dynamicDataUniqueId: 'd' },
    ];
    const result = reconcileDynamicSkuOptions(selected, fetched, [{ identificationCode: 1, total: 12 }], {
      dynamicDataUniqueId: 'd', showAdvanceButtons: true,
    });
    expect(result.map((x) => x.identificationCode)).toEqual([2, 1]);
    expect(result[1]).toMatchObject({ quantity: 4, total: 12, history: [2, 6] });
    expect(result[0]).toMatchObject({ quantity: 1, total: 0, history: [] });
  });

  it('supports immutable SKU add, duplicate rejection, remove, and manual totals', () => {
    const empty: DynamicSkuItemState[] = [];
    const first = addDynamicSku(empty, { identificationCode: '1', quantity: 5 }, 'd', false);
    expect(first[0]).toMatchObject({ quantity: 1, total: null, history: [], dynamicDataUniqueId: 'd' });
    expect(addDynamicSku(first, { identificationCode: 1 }, 'd', true)).toBe(first);
    const changed = setDynamicSkuTotal(first, '1', 0);
    expect(changed).not.toBe(first);
    expect(sumDynamicSkuTotals(changed)).toBe(0);
    expect(removeDynamicSku(changed, 1)).toEqual([]);
    expect(removeDynamicSku(changed, 99)).toBe(changed);
  });

  it('implements legacy increment/decrement history and prevents negative totals', () => {
    const selected: DynamicSkuItemState[] = [{
      identificationCode: 7, quantity: 3, total: 5, history: [2],
    }];
    const plus = incrementDynamicSku(selected, 7);
    expect(plus[0]).toMatchObject({ quantity: 1, total: 8, history: [2, 3] });
    const minus = decrementDynamicSku(plus, 7);
    expect(minus[0]).toMatchObject({ quantity: 1, total: 7, history: [2, 3, -1] });
    const noNegative = decrementDynamicSku([{
      identificationCode: 8, quantity: 10, total: 2, history: [],
    }], 8);
    expect(noNegative[0].total).toBe(0);
  });

  it('preserves immutable references for unknown records and unchanged decrement', () => {
    const selected: DynamicSkuItemState[] = [{ identificationCode: 1, quantity: 1, total: 0 }];
    expect(incrementDynamicSku(selected, 2)).toBe(selected);
    expect(decrementDynamicSku(selected, 1)).toBe(selected);
  });

  it('validates required SKU lists while accepting an explicit zero total', () => {
    expect(validateDynamicSkuSelection([], true)).toBe('min');
    expect(validateDynamicSkuSelection([{ total: null }], true)).toBe('invalid');
    expect(validateDynamicSkuSelection([{ total: '' as unknown as number }], true)).toBe('invalid');
    expect(validateDynamicSkuSelection([{ total: 0 }], true)).toBeNull();
    expect(validateDynamicSkuSelection([], false)).toBeNull();
  });
  it('keeps RetailAudit autocomplete distinct from SKU initial-list mode', () => {
    const retail = createDynamicDataQuestionRegistration({ uniqueIdPerForm: 'retail', questionType: FormQuestionTypesEnum.RetailAudit, dynamicDataUniqueId: 'catalog' }, 'form');
    expect(retail?.mode).toBe('retail-audit-autocomplete');
    expect(retail?.mode).not.toBe('sku-initial-list');
  });

});

describe('RetailAudit product answer isolation', () => {
  const option = {
    dynamicDataUniqueId: 'products',
    identificationCode: 17,
    answerTitle: 'Product 17',
    ordering: 1,
  };

  it('rejects duplicate products by default and permits separately addressable duplicate rows when configured', () => {
    const first = addRetailAuditItem([], option, 'row-1', 'products', false);
    expect(addRetailAuditItem(first, option, 'row-2', 'products', false)).toBe(first);

    const duplicated = addRetailAuditItem(first, option, 'row-2', 'products', true);
    expect(duplicated).toHaveLength(2);
    expect(duplicated.map((item) => item.retailAuditItemId)).toEqual(['row-1', 'row-2']);
    expect(duplicated[0].questionChilds).not.toBe(duplicated[1].questionChilds);
  });

  it('updates one duplicate product child-answer snapshot without sharing nested references', () => {
    const rows = addRetailAuditItem(
      addRetailAuditItem([], option, 'row-1', 'products', true),
      option, 'row-2', 'products', true,
    );
    const child = { questionId: 'child-q', answer: 'A', questionChilds: [{ questionId: 'nested-q', answer: 3 }] };
    const changed = updateRetailAuditItemAnswers(rows, 'row-1', [child], { region: 'north' }, true);

    expect(changed[0]).toMatchObject({ formValid: true, retaliVariables: { region: 'north' } });
    expect(changed[1]).toMatchObject({ formValid: undefined, questionChilds: [], retaliVariables: {} });
    expect(changed[0].questionChilds).not.toBe(rows[0].questionChilds);
    expect(changed[0].questionChilds[0]).not.toBe(child);
    expect(Object.isFrozen(changed[0].questionChilds[0])).toBe(true);
  });

  it('removes by row identity, not by product record ID', () => {
    const rows = addRetailAuditItem(
      addRetailAuditItem([], option, 'row-1', 'products', true),
      option, 'row-2', 'products', true,
    );
    const remaining = removeRetailAuditItem(rows, 'row-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retailAuditItemId).toBe('row-2');
    expect(removeRetailAuditItem(remaining, 'missing')).toBe(remaining);
  });

  it('mirrors required completion and mandatory all-record validation independently', () => {
    const rows = addRetailAuditItem([], option, 'row-1', 'products', true);
    expect(validateRetailAuditSelection(rows, true, false, 4)).toMatchObject({
      required: true, mandatoryCompletionAllRecords: false, isValid: false,
    });
    const completed = updateRetailAuditItemAnswers(rows, 'row-1', [{ answer: 1 }], {}, true);
    expect(validateRetailAuditSelection(completed, true, false, 4).isValid).toBe(true);
    expect(validateRetailAuditSelection(completed, false, true, 4)).toMatchObject({
      required: false, mandatoryCompletionAllRecords: true, isValid: false,
    });
  });
});
