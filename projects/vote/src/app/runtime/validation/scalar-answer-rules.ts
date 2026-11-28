import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { AnswerValue } from '../state/answer-state.types';

export interface ScalarAnswerValidation {
  readonly code: 'required' | 'min' | 'max' | 'email' | 'mobile' | 'phone' |
    'national-code' | 'decimal-precision' | 'date-before-min' | 'date-after-max' | 'invalid';
}

export interface ScalarAnswerConstraints {
  readonly required?: boolean;
  readonly minimum?: number | string | null;
  readonly maximum?: number | string | null;
  readonly pattern?: string | null;
  readonly maxDecimalDigit?: number | string | null;
  readonly isDecimal?: boolean;
  readonly minimumDate?: string | null;
  readonly maximumDate?: string | null;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MOBILE_PREFIXES = new Set([
  '900','901','902','903','904','905','910','911','912','913','914','915','916',
  '917','918','919','920','921','922','923','930','931','932','933','934','935',
  '936','937','938','939','941','990','991','992','993','994','995','996','998','999',
]);

export function dateOnly(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) return null;
  const [year, month, day] = match[1].split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? match[1]
    : null;
}

export function normalizeDigits(value: string): string {
  return Array.from(value, (char) => {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian >= 0) return String(persian);
    const arabic = ARABIC_DIGITS.indexOf(char);
    return arabic >= 0 ? String(arabic) : char;
  }).join('');
}

export function isValidIranianNationalCode(value: string): boolean {
  const code = normalizeDigits(value);
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const sum = Array.from(code.slice(0, 9), (digit, index) =>
    Number(digit) * (10 - index),
  ).reduce((total, part) => total + part, 0);
  const remainder = sum % 11;
  const checkDigit = Number(code[9]);
  return remainder < 2 ? checkDigit === remainder : checkDigit === 11 - remainder;
}

export function isValidIranianMobile(value: string): boolean {
  const mobile = normalizeDigits(value).replace(/[\s-]/g, '');
  return /^09\d{9}$/.test(mobile) && MOBILE_PREFIXES.has(mobile.slice(1, 4));
}

/** Pure domain validation shared by renderers and final submission validation. */
export function validateScalarAnswer(
  questionType: FormQuestionTypesEnum | undefined,
  value: AnswerValue,
  constraints: ScalarAnswerConstraints = {},
): ScalarAnswerValidation | null {
  const empty = value === '' || value === null || value === undefined;
  if (empty) return constraints.required ? { code: 'required' } : null;

  if (questionType === FormQuestionTypesEnum.Numeric || questionType === FormQuestionTypesEnum.Point) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return { code: 'invalid' };
    const minimum = constraints.minimum == null
      ? (questionType === FormQuestionTypesEnum.Point ? 0 : null)
      : Number(constraints.minimum);
    const maximum = constraints.maximum == null
      ? (questionType === FormQuestionTypesEnum.Point ? 100 : null)
      : Number(constraints.maximum);
    if (minimum !== null && Number.isFinite(minimum) && number < minimum) return { code: 'min' };
    if (maximum !== null && Number.isFinite(maximum) && number > maximum) return { code: 'max' };
    if (questionType === FormQuestionTypesEnum.Numeric && constraints.isDecimal && constraints.maxDecimalDigit != null) {
      const precision = Number(constraints.maxDecimalDigit);
      if (Number.isInteger(precision) && precision >= 0) {
        const fraction = String(number).toLowerCase().split('e')[0].split('.')[1] ?? '';
        if (fraction.length > precision) return { code: 'decimal-precision' };
      }
    }
    return null;
  }

  const text = String(value);
  if (questionType === FormQuestionTypesEnum.Date) {
    const date = dateOnly(text);
    if (!date) return { code: 'invalid' };
    const minimumDate = constraints.minimumDate ? dateOnly(constraints.minimumDate) : null;
    const maximumDate = constraints.maximumDate ? dateOnly(constraints.maximumDate) : null;
    if (minimumDate && date < minimumDate) return { code: 'date-before-min' };
    if (maximumDate && date > maximumDate) return { code: 'date-after-max' };
  }
  if (questionType === FormQuestionTypesEnum.CustomMaskShortText && constraints.pattern) {
    try {
      if (!new RegExp(constraints.pattern).test(text)) return { code: 'invalid' };
    } catch {
      // An invalid archived pattern must not make the entire question unusable.
    }
  }
  if (questionType === FormQuestionTypesEnum.Email && !/^[\w-.]+@([\w-]+\.)+[\w-]+$/.test(text)) {
    return { code: 'email' };
  }
  if (questionType === FormQuestionTypesEnum.Mobile && !isValidIranianMobile(text)) {
    return { code: 'mobile' };
  }
  if (questionType === FormQuestionTypesEnum.Phone && !/^0\d{10}$/.test(normalizeDigits(text).replace(/[\s-]/g, ''))) {
    return { code: 'phone' };
  }
  if (questionType === FormQuestionTypesEnum.NationalCode && !isValidIranianNationalCode(text)) {
    return { code: 'national-code' };
  }

  const minimum = constraints.minimum == null ? null : Number(constraints.minimum);
  const maximum = constraints.maximum == null ? null : Number(constraints.maximum);
  if (minimum !== null && Number.isFinite(minimum) && text.length < minimum) return { code: 'min' };
  if (maximum !== null && Number.isFinite(maximum) && text.length > maximum) return { code: 'max' };
  return null;
}
