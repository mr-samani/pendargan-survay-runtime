import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { normalizeScalarAnswerValue, validateScalarAnswer } from './scalar-answer-value';

describe('normalizeScalarAnswerValue', () => {
  it('converts numeric input to a finite number', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '12.5')).toBe(12.5);
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '-4')).toBe(-4);
  });

  it('preserves empty numeric values instead of converting them to zero', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '')).toBe('');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '   ')).toBe('');
  });

  it('rejects non-finite numeric values as an empty answer', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, 'Infinity')).toBe('');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, 'not-a-number')).toBe('');
  });

  it('preserves date, time, and text values exactly', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Date, '2026-11-25')).toBe('2026-11-25');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Time, '09:45')).toBe('09:45');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.ShortText, '  text  ')).toBe('  text  ');
  });
});

describe('validateScalarAnswer', () => {
  it('validates required values without treating zero as empty', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, '', { required: true })).toEqual({ code: 'required' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 0, { required: true })).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, '', { required: false })).toBeNull();
  });

  it('enforces numeric minimum and maximum constraints', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 2, { minimum: 3 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 12, { maximum: 10 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 5, { minimum: 1, maximum: 10 })).toBeNull();
  });

  it('validates email format and does not impose it on other text types', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Email, 'not-an-email')).toEqual({ code: 'email' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Email, 'person@example.com')).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'not-an-email')).toBeNull();
  });

  it('validates custom masks without discarding the user draft', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.CustomMaskShortText, '12x', { pattern: '^\\\\d+
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'a', { minimum: 2 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abcd', { maximum: 3 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abc', { minimum: 2, maximum: 3 })).toBeNull();
  });
});
 })).toEqual({ code: 'invalid' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.CustomMaskShortText, '123', { pattern: '^\\\\d+
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'a', { minimum: 2 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abcd', { maximum: 3 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abc', { minimum: 2, maximum: 3 })).toBeNull();
  });
});
 })).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.CustomMaskShortText, '12', { minimum: 3 })).toEqual({ code: 'min' });
  });

  it('enforces text length boundaries', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'a', { minimum: 2 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abcd', { maximum: 3 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abc', { minimum: 2, maximum: 3 })).toBeNull();
  });
});
