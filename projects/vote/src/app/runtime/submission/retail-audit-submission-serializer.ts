import { FormQuestionTypesEnum, RepeatedFormSectionDto } from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerValue, QuestionAnswerState } from '../state/answer-state.types';
import { serializeQuestionAnswer } from './question-answer-serializer';

export class RetailAuditSubmissionSerializationError extends Error {
  constructor(readonly code: string, readonly path: string, message: string) {
    super(message);
    this.name = 'RetailAuditSubmissionSerializationError';
  }
}

export interface RetailAuditSubmissionResult {
  readonly repeatSections: readonly RepeatedFormSectionDto[];
  readonly variablesLastValue: Readonly<Record<string, string>>;
}

/** Mirrors the legacy RetailAudit-to-repeated-section conversion. */
export function serializeRetailAuditRows(
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState,
  definition: SurveyDefinition,
  temporarySave: boolean,
): RetailAuditSubmissionResult {
  if (answer.questionId !== question.id || question.questionType !== FormQuestionTypesEnum.RetailAudit) {
    throw new RetailAuditSubmissionSerializationError('RETAIL_AUDIT_QUESTION_MISMATCH', question.id, 'Invalid RetailAudit answer.');
  }
  if (answer.value === null) return { repeatSections: [], variablesLastValue: {} };
  if (!Array.isArray(answer.value)) {
    throw new RetailAuditSubmissionSerializationError('RETAIL_AUDIT_ITEMS_INVALID', question.id + '.value', 'Expected a RetailAudit item list.');
  }

  const dynamicQuestion: SurveyQuestionDefinition = {
    ...question, questionType: FormQuestionTypesEnum.DynamicAnswer, options: [], settings: null,
    isActive: true, isRequired: false,
  };
  const repeatSections: RepeatedFormSectionDto[] = [];
  const variablesLastValue: Record<string, string> = {};

  answer.value.forEach((item, rowIndex) => {
    const row = record(item);
    if (temporarySave ? row['formValid'] === undefined : row['formValid'] !== true) return;
    const id = row['identificationCode'];
    if (!(typeof id === 'string' && id.trim()) && !(typeof id === 'number' && Number.isSafeInteger(id))) {
      throw new RetailAuditSubmissionSerializationError(
        'RETAIL_AUDIT_RECORD_ID_INVALID', question.id + '.value[' + rowIndex + '].identificationCode',
        'Missing RetailAudit record ID.',
      );
    }

    const title = typeof row['answerTitle'] === 'string' ? row['answerTitle'] : '';
    const dynamicAnswer: QuestionAnswerState = {
      questionId: question.id, value: { identificationCode: id, answerTitle: title },
      selectedOptionIds: [], isDirty: false, updatedAtRevision: answer.updatedAtRevision,
    };
    const details = [...serializeQuestionAnswer(dynamicQuestion, dynamicAnswer)];
    const children = Array.isArray(row['questionChilds']) ? row['questionChilds'] : [];
    const flattened = children.flatMap((value) => {
      const child = record(value);
      return [FormQuestionTypesEnum.Matrix, FormQuestionTypesEnum.Matrix_Dynamic, FormQuestionTypesEnum.Group]
        .includes(child['questionType'] as FormQuestionTypesEnum)
        ? (Array.isArray(child['questionChilds']) ? child['questionChilds'] : [])
        : [value];
    });

    flattened.forEach((value, childIndex) => {
      const child = record(value);
      const ref = string(child['questionId']) ?? string(child['uniqueIdPerForm']) ?? string(child['uniqueId']);
      const childQuestion = definition.questions.find((candidate) =>
        candidate.id === ref || candidate.sourceId === ref || candidate.uniqueIdPerForm === ref);
      if (!childQuestion) {
        throw new RetailAuditSubmissionSerializationError(
          'RETAIL_AUDIT_CHILD_NOT_IN_DEFINITION',
          question.id + '.value[' + rowIndex + '].questionChilds[' + childIndex + ']',
          'Unknown RetailAudit child question.',
        );
      }
      details.push(...serializeQuestionAnswer(childQuestion, childAnswer(childQuestion, child, answer.updatedAtRevision), {
        dynamicDataRecordId: id,
        isVisible: child['isActive'] !== false && child['dontShow'] !== true,
        isEndForm: child['endForm'] === true,
        hasVisibleQuestionOrOption: child['hasVisibleQuestionOrOption'] !== false,
      }));
    });

    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(record(row['retaliVariables']))) {
      if (typeof value === 'string') variables[key] = value;
    }
    repeatSections.push(new RepeatedFormSectionDto({
      voterAnswerDetails: details,
      variablesRepeatedSectionValue: variables,
    }));
    Object.assign(variablesLastValue, variables);
  });

  return { repeatSections, variablesLastValue };
}

function childAnswer(
  question: SurveyQuestionDefinition,
  child: Readonly<Record<string, unknown>>,
  revision: number,
): QuestionAnswerState {
  const optionModels = Array.isArray(child['questionOptions']) ? child['questionOptions'] : [];
  const selectedOptionIds = Array.isArray(child['selectedOptionIds'])
    ? child['selectedOptionIds'].filter((id): id is string => typeof id === 'string')
    : optionModels.flatMap((value) => {
        const option = record(value);
        if (option['selected'] !== true || option['dontShow'] === true) return [];
        const ref = string(option['uniqueIdPerForm']) ?? string(option['uniqueId']);
        const match = question.options.find((candidate) =>
          candidate.id === ref || candidate.sourceId === ref || candidate.uniqueIdPerForm === ref);
        return match ? [match.id] : [];
      });

  let value = (child['answer'] ?? null) as AnswerValue;
  if (question.questionType === FormQuestionTypesEnum.Captcha || question.questionType === FormQuestionTypesEnum.Payment) {
    value = {
      answer: value ?? '', validationGuid: value ?? '',
      validationKey: string(child['validationKey']) ?? '',
    };
  } else if (question.questionType === FormQuestionTypesEnum.MultiSelect) {
    const descriptions: Record<string, AnswerValue> = {};
    for (const model of optionModels) {
      const option = record(model);
      const ref = string(option['uniqueIdPerForm']) ?? string(option['uniqueId']);
      const match = question.options.find((candidate) =>
        candidate.id === ref || candidate.sourceId === ref || candidate.uniqueIdPerForm === ref);
      if (match && typeof option['answerDescription'] === 'string') descriptions[match.id] = option['answerDescription'];
    }
    value = { descriptionAnswer: string(child['descriptionAnswer']) ?? '', optionDescriptions: descriptions };
  }

  return {
    questionId: question.id, value, selectedOptionIds, isDirty: false, updatedAtRevision: revision,
  };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : {};
}
function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}
