import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import type { QuestionAnswerState } from '../state/answer-state.types';

export interface LegacyOptionAnswerProjection {
  readonly optionId: string;
  readonly sourceOptionId?: string;
  readonly selected: boolean;
  readonly answerDescription: string;
  readonly orderAnswer?: number;
}

export interface LegacyQuestionAnswerProjection {
  readonly answer: unknown;
  readonly descriptionAnswer: string;
  readonly options: readonly LegacyOptionAnswerProjection[];
  readonly hasAnswer: boolean;
}

const CHOICE_TYPES = new Set<FormQuestionTypesEnum>([
  FormQuestionTypesEnum.UniqueSelect,
  FormQuestionTypesEnum.Dropdown,
  FormQuestionTypesEnum.MultiSelect,
  FormQuestionTypesEnum.Matrix_Radio,
  FormQuestionTypesEnum.Matrix_Checkbox,
  FormQuestionTypesEnum.Matrix_MultiShortText,
  FormQuestionTypesEnum.Matrix_MultiNumeric,
  FormQuestionTypesEnum.Emoji,
  FormQuestionTypesEnum.UniqueSelectWithImageOptions,
  FormQuestionTypesEnum.MultiSelectWithImageOptions,
  FormQuestionTypesEnum.HasPriority,
]);

/**
 * Projects one canonical answer into the legacy QuestionModel shape.
 *
 * This is deliberately a projection, not a second store: the immutable answer
 * snapshot remains authoritative and this result only hydrates existing views
 * and the legacy formula-engine model.
 */
export function projectCanonicalAnswerToLegacy(
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState | undefined,
): LegacyQuestionAnswerProjection {
  const value = answer?.value ?? null;
  const selectedIds = answer?.selectedOptionIds ?? [];
  const selected = new Set(selectedIds);
  const selectedOrder = new Map(selectedIds.map((id, index) => [id, index] as const));
  const optionById = new Map(question.options.map((option) => [option.id, option] as const));
  const valueRecord = asRecord(value);
  const optionDescriptions = asRecord(valueRecord?.['optionDescriptions']);
  const matrixValues = valueRecord && !('optionDescriptions' in valueRecord)
    ? valueRecord
    : undefined;

  const options = question.options.map((option) => {
    const index = selectedOrder.get(option.id) ?? -1;
    const cellValue = matrixValues?.[option.id];
    const isMatrixCell = question.questionType === FormQuestionTypesEnum.Matrix_MultiShortText ||
      question.questionType === FormQuestionTypesEnum.Matrix_MultiNumeric;
    const description = isMatrixCell
      ? scalarText(cellValue)
      : scalarText(optionDescriptions?.[option.id]);
    return Object.freeze({
      optionId: option.id,
      sourceOptionId: option.sourceId,
      selected: isMatrixCell ? cellValue !== undefined && cellValue !== null && cellValue !== '' : selected.has(option.id),
      answerDescription: description,
      orderAnswer: index < 0 ? undefined : index,
    });
  });

  let legacyAnswer: unknown = value;
  if (CHOICE_TYPES.has(question.questionType!)) {
    const orderedIds = selectedIds.map((id) => optionById.get(id)?.sourceId ?? id);
    if (question.questionType === FormQuestionTypesEnum.HasPriority && valueRecord &&
      typeof valueRecord['answer'] === 'string') {
      legacyAnswer = valueRecord['answer'];
    } else if (question.questionType === FormQuestionTypesEnum.HasPriority && value !== null) {
      legacyAnswer = value;
    } else {
      legacyAnswer = orderedIds.join(',');
    }
  } else if (valueRecord && Object.prototype.hasOwnProperty.call(valueRecord, 'value')) {
    legacyAnswer = valueRecord['value'];
  }

  const descriptionAnswer = scalarText(valueRecord?.['descriptionAnswer']);
  const hasAnswer = selectedIds.length > 0 ||
    (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0));

  return Object.freeze({
    answer: legacyAnswer,
    descriptionAnswer,
    options: Object.freeze(options),
    hasAnswer,
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function scalarText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}
