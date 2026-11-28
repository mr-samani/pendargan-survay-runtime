import { describe, expect, it } from 'vitest';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import {
  isValidIranianMobile,
  isValidIranianNationalCode,
  normalizeDigits,
  normalizeScalarAnswerValue,
  validateScalarAnswer,
} from './scalar-answer-value';

describe('normalizeScalarAnswerValue', () => {
  it('converts numeric input to a finite number', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '12.5')).toBe(12.5);
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '-4')).toBe(-4);
  });

  it('preserves empty numeric values and rejects non-finite input', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '')).toBe('');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, '   ')).toBe('');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, 'Infinity')).toBe('');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Numeric, 'not-a-number')).toBe('');
  });

  it('preserves date, time, and text values exactly', () => {
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Date, '2026-11-25')).toBe('2026-11-25');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.Time, '09:45')).toBe('09:45');
    expect(normalizeScalarAnswerValue(FormQuestionTypesEnum.ShortText, '  text  ')).toBe('  text  ');
  });
});

describe('Iranian scalar validators', () => {
  it('normalizes Persian and Arabic-Indic digits', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('validates national-code checksum and rejects repeated digits', () => {
    expect(isValidIranianNationalCode('1234567891')).toBe(true);
    expect(isValidIranianNationalCode('۱۲۳۴۵۶۷۸۹۱')).toBe(true);
    expect(isValidIranianNationalCode('1111111111')).toBe(false);
    expect(isValidIranianNationalCode('123')).toBe(false);
  });

  it('validates mobile length and known operator prefixes', () => {
    expect(isValidIranianMobile('09121234567')).toBe(true);
    expect(isValidIranianMobile('۰۹۱۲۱۲۳۴۵۶۷')).toBe(true);
    expect(isValidIranianMobile('09991234567')).toBe(true);
    expect(isValidIranianMobile('0912123456')).toBe(false);
    expect(isValidIranianMobile('09881234567')).toBe(false);
  });
});

describe('validateScalarAnswer', () => {
  it('validates required values without treating zero as empty', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, '', { required: true })).toEqual({ code: 'required' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 0, { required: true })).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, '', { required: false })).toBeNull();
  });

  it('enforces numeric minimum, maximum, and decimal precision', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 2, { minimum: 3 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 12, { maximum: 10 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 5, { minimum: 1, maximum: 10 })).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 1.234, { isDecimal: true, maxDecimalDigit: 2 })).toEqual({ code: 'decimal-precision' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 1.23, { isDecimal: true, maxDecimalDigit: 2 })).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 1e-7, { isDecimal: true, maxDecimalDigit: 2 })).toEqual({ code: 'decimal-precision' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Numeric, 1.234, { isDecimal: false, maxDecimalDigit: 2 })).toBeNull();
  });

  it('validates email, mobile, phone and national code formats', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.Email, 'bad')).toEqual({ code: 'email' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Email, 'person@example.com')).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.Mobile, '09121234567')).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.Mobile, '0912123456')).toEqual({ code: 'mobile' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.Phone, '02112345678')).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.Phone, '123')).toEqual({ code: 'phone' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.NationalCode, '1234567891')).toBeNull();
    expect(validateScalarAnswer(FormQuestionTypesEnum.NationalCode, '1111111111')).toEqual({ code: 'national-code' });
  });

  it('validates custom masks without discarding the user draft', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.CustomMaskShortText, '12x', { pattern: '^\\d+$' })).toEqual({ code: 'invalid' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.CustomMaskShortText, '123', { pattern: '^\\d+$' })).toBeNull();
  });

  it('enforces text length boundaries', () => {
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'a', { minimum: 2 })).toEqual({ code: 'min' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abcd', { maximum: 3 })).toEqual({ code: 'max' });
    expect(validateScalarAnswer(FormQuestionTypesEnum.ShortText, 'abc', { minimum: 2, maximum: 3 })).toBeNull();
  });
});
