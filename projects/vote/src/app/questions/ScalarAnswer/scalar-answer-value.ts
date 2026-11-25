import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

export interface ScalarAnswerValidation {
  readonly code: 'required' | 'min' | 'max' | 'email' | 'invalid';
}

/** Convert native input strings into the canonical scalar representation. */
export function normalizeScalarAnswerValue(
  questionType: FormQuestionTypesEnum | undefined,
  rawValue: string,
): AnswerValue {
  if (questionType === FormQuestionTypesEnum.Numeric) {
    if (rawValue.trim() === '') return '';
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : '';
  }

  // Native date/time inputs already emit the backend-compatible ISO fragments:
  // yyyy-MM-dd and HH:mm. Text-like answers remain strings without coercion.
  return rawValue;
}

/** Validate the scalar constraints that can be enforced without host services. */
export function validateScalarAnswer(
  questionType: FormQuestionTypesEnum | undefined,
  value: AnswerValue,
  constraints: {
    required?: boolean;
    minimum?: number | string | null;
    maximum?: number | string | null;
    pattern?: string | null;
  } = {},
): ScalarAnswerValidation | null {
  const empty = value === '' || value === null || value === undefined;
  if (empty) return constraints.required ? { code: 'required' } : null;

  if (questionType === FormQuestionTypesEnum.Numeric) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return { code: 'invalid' };
    const minimum = constraints.minimum == null ? null : Number(constraints.minimum);
    const maximum = constraints.maximum == null ? null : Number(constraints.maximum);
    if (minimum !== null && Number.isFinite(minimum) && number < minimum) return { code: 'min' };
    if (maximum !== null && Number.isFinite(maximum) && number > maximum) return { code: 'max' };
    return null;
  }

  const text = String(value);
  if (questionType === FormQuestionTypesEnum.CustomMaskShortText && constraints.pattern) {
    try {
      if (!new RegExp(constraints.pattern).test(text)) return { code: 'invalid' };
    } catch {
      // An invalid pattern in an old survey must not make the entire question unusable.
    }
  }
  if (questionType === FormQuestionTypesEnum.Email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return { code: 'email' };
  }

  const minimum = constraints.minimum == null ? null : Number(constraints.minimum);
  const maximum = constraints.maximum == null ? null : Number(constraints.maximum);
  if (minimum !== null && Number.isFinite(minimum) && text.length < minimum) return { code: 'min' };
  if (maximum !== null && Number.isFinite(maximum) && text.length > maximum) return { code: 'max' };
  return null;
}
