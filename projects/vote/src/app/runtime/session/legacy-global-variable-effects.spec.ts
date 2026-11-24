import { FormQuestionTypesEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import { projectLegacyGlobalVariableQuestionEffects } from './legacy-global-variable-effects';

function question(
  id: string,
  type: FormQuestionTypesEnum,
  initialValue: string | undefined,
  source: Record<string, unknown> = {},
): SurveyQuestionDefinition {
  return {
    id,
    uniqueIdPerForm: id + '-fid',
    questionType: type,
    source,
    isActive: true,
    isRequired: false,
    initialValue,
    settings: { amount: 0 },
    options: [],
  };
}

describe('projectLegacyGlobalVariableQuestionEffects', () => {
  it('replaces a global variable in a normal question initial value', () => {
    const q = question('name', FormQuestionTypesEnum.ShortText, 'Hello [%name%]', {
      hasInitialValue: true,
    });
    const result = projectLegacyGlobalVariableQuestionEffects(q, 'name', 'Sara');
    expect(result).toEqual({
      questionId: 'name',
      answerValue: 'Hello Sara',
      evaluateInitialValue: 'Hello Sara',
      paymentAmount: undefined,
      secondaryFieldValueFilter: undefined,
      shouldRecalculateAnswer: true,
      shouldTriggerDynamicFilter: false,
    });
  });

  it('does not assign an initial value when the substituted value still starts with another variable token', () => {
    const q = question('name', FormQuestionTypesEnum.ShortText, '[%other%] - [%name%]', {
      hasInitialValue: true,
    });
    const result = projectLegacyGlobalVariableQuestionEffects(q, 'name', 'Sara');
    expect(result.answerValue).toBeUndefined();
    expect(result.evaluateInitialValue).toBeUndefined();
    expect(result.shouldRecalculateAnswer).toBe(true);
  });

  it('sets Payment amount only to an integer and resets non-integer values to zero', () => {
    const q = question('payment', FormQuestionTypesEnum.Payment, '[%amount%]', {
      hasInitialValue: true,
    });
    expect(projectLegacyGlobalVariableQuestionEffects(q, 'amount', '125').paymentAmount).toBe(125);
    expect(projectLegacyGlobalVariableQuestionEffects(q, 'amount', '125.5').paymentAmount).toBe(0);
  });

  it('updates secondary filter and requests dynamic refresh for SkuCount_Dynamic', () => {
    const q = question('sku', FormQuestionTypesEnum.SkuCount_Dynamic, undefined, {
      secondaryFilterValue: 'category=[%category%]',
      secondaryFieldValueFilter: 'category=old',
    });
    const result = projectLegacyGlobalVariableQuestionEffects(q, 'category', 'food');
    expect(result.secondaryFieldValueFilter).toBe('category=food');
    expect(result.shouldTriggerDynamicFilter).toBe(true);
    expect(result.shouldRecalculateAnswer).toBe(true);
  });

  it('does not refresh unchanged, unresolved, or reset secondary filters', () => {
    const unchanged = question('sku', FormQuestionTypesEnum.RetailAudit, undefined, {
      secondaryFilterValue: 'category=[%category%]',
      secondaryFieldValueFilter: 'category=food',
    });
    const unresolved = question('sku-2', FormQuestionTypesEnum.SkuCount_Dynamic, undefined, {
      secondaryFilterValue: 'category=[%category%] AND region=[%region%]',
    });
    const reset = question('sku-3', FormQuestionTypesEnum.SkuCount_Dynamic, undefined, {
      secondaryFilterValue: 'category=[%category%]',
    });
    expect(projectLegacyGlobalVariableQuestionEffects(unchanged, 'category', 'food').shouldTriggerDynamicFilter).toBe(false);
    expect(projectLegacyGlobalVariableQuestionEffects(unresolved, 'category', 'food').shouldTriggerDynamicFilter).toBe(false);
    const resetResult = projectLegacyGlobalVariableQuestionEffects(reset, 'category', 'food', true);
    expect(resetResult.secondaryFieldValueFilter).toBeUndefined();
    expect(resetResult.shouldTriggerDynamicFilter).toBe(false);
    expect(resetResult.shouldRecalculateAnswer).toBe(true);
  });

  it('recalculates questions with secondary filters even when they are not dynamic question types', () => {
    const q = question('text', FormQuestionTypesEnum.ShortText, undefined, {
      secondaryFilterValue: 'region=[%region%]',
    });
    const result = projectLegacyGlobalVariableQuestionEffects(q, 'region', 'north');
    expect(result.secondaryFieldValueFilter).toBeUndefined();
    expect(result.shouldTriggerDynamicFilter).toBe(false);
    expect(result.shouldRecalculateAnswer).toBe(true);
  });

  it('replaces null and empty global variable results with an empty string', () => {
    const q = question('text', FormQuestionTypesEnum.ShortText, 'Value: [%value%]', {
      hasInitialValue: true,
    });
    expect(projectLegacyGlobalVariableQuestionEffects(q, 'value', null).answerValue).toBe('Value: ');
    expect(projectLegacyGlobalVariableQuestionEffects(q, 'value', '').answerValue).toBe('Value: ');
  });
});
