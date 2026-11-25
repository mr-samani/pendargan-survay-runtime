import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionModel } from './question';

describe('QuestionModel runtime overrides', () => {
  it('prefers canonical runtime visibility while retaining the legacy fallback', () => {
    const question = new QuestionModel({
      uniqueId: 'visibility-source',
      uniqueIdPerForm: 'visibility-fid',
      questionType: FormQuestionTypesEnum.ShortText,
      questionOptions: [],
    } as never);

    question.runtimeVisibility.set(false);
    expect(question.canShow()).toBe(false);
    question.runtimeVisibility.set(true);
    expect(question.canShow()).toBe(true);
    question.runtimeVisibility.set(undefined);
    expect(() => question.canShow()).toThrow();
  });

  it('uses a runtime Payment amount without mutating the API settings', () => {
    const question = new QuestionModel({
      uniqueId: 'payment-source',
      uniqueIdPerForm: 'payment-fid',
      questionType: FormQuestionTypesEnum.Payment,
      settings: { amount: 50 },
      questionOptions: [],
    } as never);

    expect(question.effectivePaymentAmount()).toBe(50);
    question.runtimePaymentAmount.set(125);
    expect(question.effectivePaymentAmount()).toBe(125);
    expect(question.settings?.['amount']).toBe(50);
    question.runtimePaymentAmount.set(undefined);
    expect(question.effectivePaymentAmount()).toBe(50);
  });

  it('uses the runtime dynamic expression filter and restores the legacy fallback', () => {
    const question = new QuestionModel({
      uniqueId: 'dynamic-source',
      uniqueIdPerForm: 'dynamic-fid',
      questionType: FormQuestionTypesEnum.DynamicAnswer,
      questionOptions: [],
    } as never);

    expect(question.effectiveFieldValueFilter()).toBe('');
    question.runtimeFieldValueFilter.set("Status eq 'active'");
    expect(question.effectiveFieldValueFilter()).toBe("Status eq 'active'");
    question.runtimeFieldValueFilter.set(undefined);
    expect(question.effectiveFieldValueFilter()).toBe('');
  });

  it('uses the runtime secondary filter and falls back to the original DTO value', () => {
    const question = new QuestionModel({
      uniqueId: 'sku-source',
      uniqueIdPerForm: 'sku-fid',
      questionType: FormQuestionTypesEnum.SkuCount_Dynamic,
      secondaryFieldValueFilter: 'category=original',
      questionOptions: [],
    } as never);

    expect(question.effectiveSecondaryFieldValueFilter()).toBe('category=original');
    question.runtimeSecondaryFieldValueFilter.set('category=food');
    expect(question.effectiveSecondaryFieldValueFilter()).toBe('category=food');
    question.runtimeSecondaryFieldValueFilter.set(undefined);
    expect(question.effectiveSecondaryFieldValueFilter()).toBe('category=original');
  });
});
