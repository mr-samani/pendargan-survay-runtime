import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { AnswerValue } from '../../runtime/state/answer-state.types';

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
