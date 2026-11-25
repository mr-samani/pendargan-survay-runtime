import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { normalizeScalarAnswerValue } from './scalar-answer-value';

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
