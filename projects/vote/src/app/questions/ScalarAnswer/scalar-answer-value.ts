import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { AnswerValue } from '../../runtime/state/answer-state.types';
export {
  isValidIranianMobile,
  isValidIranianNationalCode,
  normalizeDigits,
  validateScalarAnswer,
} from '../../runtime/validation/scalar-answer-rules';
export type {
  ScalarAnswerConstraints,
  ScalarAnswerValidation,
} from '../../runtime/validation/scalar-answer-rules';

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
  return rawValue;
}
