import {
  FormQuestionTypesEnum,
  RepeatedFormSectionDto,
} from '@service-proxies/models';
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

/**
 * Recreates ConverterDataService.changeRetailAuditToSectionLoop:
 * every eligible selected SKU becomes one backend repeated-section page,
 * beginning with a synthetic DynamicAnswer row, followed by that SKU's
 * flattened child-question answers.
 */
export function serializeRetailAuditRows(
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState,
  definition: SurveyDefinition,
  temporarySave: boolean,
): RetailAuditSubmissionResult {
  if (answer.questionId !== question.id || question.questionType !== FormQuestionTypesEnum.RetailAudit) {
    throw new RetailAuditSubmissionSerializationError(
      'RETAIL_AUDIT_QUESTION_MISMATCH', question.id,
      'RetailAudit submission requires the matching RetailAudit question answer.',
    );
  }
  if (answer.value === null) {
    return Object.freeze({ repeatSections: Object.freeze([]), variablesLastValue: Object.freeze({}) });
  }
  if (!Array.isArray(answer.value)) {
    throw new RetailAuditSubmissionSerializationError(
      'RETAIL_AUDIT_ITEMS_INVALID', question.id + '.value',
      'RetailAudit answers must be an array of selected product records.',
    );
  }

  const repeatSections: RepeatedFormSectionDto[] = [];
  const variablesLastValue: Record<string, string> = {};
  const dynamicQuestion: SurveyQuestionDefinition = Object.freeze({
    ...question,
    questionType: FormQuestionTypesEnum.DynamicAnswer,
    options: Object.freeze([]),
    settings: null,
    isActive: true,
    isRequired: false,
  });

  for (let rowIndex = 0; rowIndex < answer.value.length; rowIndex++) {
    const rowPath = question.id + '.value[' + rowIndex + ']';
    const row = objectRecord(answer.value[rowIndex]);
    const formValid = row['formValid'];
    // The archived converter omits incomplete SKU rows from final/partial
    // saves, but temporary saves retain explicitly attempted incomplete rows.
    if (temporarySave ? formValid === undefined : formValid !== true) continue;

    const identificationCode = row['identificationCode'];
    if (!(typeof identificationCode === 'string' && identificationCode.trim()) &&
        !(typeof identificationCode === 'number' && Number.isSafeInteger(identificationCode))) {
      throw new RetailAuditSubmissionSerializationError(
        'RETAIL_AUDIT_RECORD_ID_INVALID', rowPath + '.identificationCode',
        'A selected RetailAudit item must have a string or safe-integer identificationCode.',
      );
    }

    const answerTitle = typeof row['answerTitle'] === 'string' ? row['answerTitle'] : '';
    const syntheticAnswer: QuestionAnswerState = Object.freeze({
      questionId: question.id,
      value: Object.freeze({ identificationCode, answerTitle }),
      selectedOptionIds: Object.freeze([]),
      isDirty: false,
      updatedAtRevision: answer.updatedAtRevision,
    });
    const voterAnswerDetails = [
      ...serializeQuestionAnswer(dynamicQuestion, syntheticAnswer),
    ];

    const childModels = Array.isArray(row['questionChilds']) ? row['questionChilds'] : [];
    const flattenedChildren = childModels.flatMap((childValue) => {
      const child = objectRecord(childValue);
      const type = child['questionType'];
      if (type === FormQuestionTypesEnum.Matrix ||
          type === FormQuestionTypesEnum.Matrix_Dynamic ||
          type === FormQuestionTypesEnum.Group) {
        return Array.isArray(child['questionChilds']) ? child['questionChilds'] : [];
      }
      return [childValue];
    });

    for (let childIndex = 0; childIndex < flattenedChildren.length; childIndex++) {
      const childPath = rowPath + '.questionChilds[' + childIndex + ']';
      const child = objectRecord(flattenedChildren[childIndex]);
      const reference = firstString(child['questionId'], child['uniqueIdPerForm'], child['uniqueId']);
      const childQuestion = definition.questions.find((candidate) =>
        candidate.id === reference || candidate.sourceId === reference ||
        candidate.uniqueIdPerForm === reference,
      );
      if (!childQuestion) {
        throw new RetailAuditSubmissionSerializationError(
          'RETAIL_AUDIT_CHILD_NOT_IN_DEFINITION', childPath,
          'A RetailAudit child answer cannot be matched to a question in the current definition.',
        );
      }

      const serialized = serializeQuestionAnswer(
        childQuestion,
        buildChildAnswer(childQuestion, child, answer.updatedAtRevision, childPath),
        {
          dynamicDataRecordId: identificationCode,
          isVisible: child['dontShow'] !== true,
          isEndForm: child['endForm'] === true,
          hasVisibleQuestionOrOption: child['hasVisibleQuestionOrOption'] !== false,
          visibleOptionIds: visibleChildOptionIds(childQuestion, child),
        },
      );
      voterAnswerDetails.push(...serialized);
    }

    const variables = stringValues(row['retaliVariables']);
    repeatSections.push(new RepeatedFormSectionDto({
      voterAnswerDetails,
      variablesRepeatedSectionValue: variables,
    }));
    Object.assign(variablesLastValue, variables);
  }

  return Object.freeze({
    repeatSections: Object.freeze(repeatSections),
    variablesLastValue: Object.freeze(variablesLastValue),
  });
}

function buildChildAnswer(
  question: SurveyQuestionDefinition,
  child: Readonly<Record<string, unknown>>,
  revision: number,
  path: string,
): QuestionAnswerState {
  const selected = Array.isArray(child['selectedOptionIds'])
    ? child['selectedOptionIds'].filter((item): item is string => typeof item === 'string')
    : [];
  const selectedFromModels = Array.isArray(child['questionOptions'])
    ? child['questionOptions'].flatMap((optionValue) => {
        const option = objectRecord(optionValue);
        if (option['selected'] !== true) return [];
        const reference = firstString(option['uniqueIdPerForm'], option['uniqueId']);
        const definitionOption = question.options.find((candidate) =>
          candidate.id === reference || candidate.sourceId === reference ||
          candidate.uniqueIdPerForm === reference,
        );
        return definitionOption ? [definitionOption.id] : [];
      })
    : [];
  const selectedOptionIds = selected.length ? selected : selectedFromModels;
  let value = asAnswerValue(child['answer']);

  if (question.questionType === FormQuestionTypesEnum.Captcha ||
      question.questionType === FormQuestionTypesEnum.Payment) {
    value = {
      answer: value ?? '',
      validationGuid: value ?? '',
      validationKey: typeof child['validationKey'] === 'string' ? child['validationKey'] : '',
      ...(question.questionType === FormQuestionTypesEnum.Payment
        ? { transactionAmount: finiteOrUndefined(objectRecord(question.settings)['amount']) ?? 0 }
        : {}),
    };
  } else if (question.questionType === FormQuestionTypesEnum.MultiSelect) {
    const optionDescriptions: Record<string, AnswerValue> = {};
    for (const optionValue of Array.isArray(child['questionOptions']) ? child['questionOptions'] : []) {
      const option = objectRecord(optionValue);
      const reference = firstString(option['uniqueIdPerForm'], option['uniqueId']);
      const definitionOption = question.options.find((candidate) =>
        candidate.id === reference || candidate.sourceId === reference ||
        candidate.uniqueIdPerForm === reference,
      );
      if (definitionOption && typeof option['answerDescription'] === 'string') {
        optionDescriptions[definitionOption.id] = option['answerDescription'];
      }
    }
    value = {
      descriptionAnswer: typeof child['descriptionAnswer'] === 'string' ? child['descriptionAnswer'] : '',
      optionDescriptions,
    };
  } else if (question.questionType === FormQuestionTypesEnum.HasPriority &&
      typeof child['descriptionAnswer'] === 'string') {
    value = { answer: value ?? '', descriptionAnswer: child['descriptionAnswer'] };
  }

  if (value === undefined) value = null;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const childRecord = value as Readonly<Record<string, AnswerValue>>;
    if (question.questionType === FormQuestionTypesEnum.Payment &&
        childRecord['transactionAmount'] === undefined) {
      value = { ...childRecord, transactionAmount: finiteOrUndefined(objectRecord(question.settings)['amount']) ?? 0 };
    }
  }

  return Object.freeze({
    questionId: question.id,
    value,
    selectedOptionIds: Object.freeze(selectedOptionIds),
    isDirty: false,
    updatedAtRevision: revision,
  });
}

function visibleChildOptionIds(
  question: SurveyQuestionDefinition,
  child: Readonly<Record<string, unknown>>,
): readonly string[] | undefined {
  if (!Array.isArray(child['questionOptions'])) return undefined;
  const visible = new Set<string>();
  for (const optionValue of child['questionOptions']) {
    const option = objectRecord(optionValue);
    if (option['dontShow'] === true || option['canShow'] === false) continue;
    const reference = firstString(option['uniqueIdPerForm'], option['uniqueId']);
    const definitionOption = question.options.find((candidate) =>
      candidate.id === reference || candidate.sourceId === reference ||
      candidate.uniqueIdPerForm === reference,
    );
    if (definitionOption) visible.add(definitionOption.id);
  }
  return Object.freeze([...visible]);
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}
function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}
function asAnswerValue(value: unknown): AnswerValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value as AnswerValue[];
  if (typeof value === 'object') return value as AnswerValue;
  return undefined;
}
function finiteOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
function stringValues(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') result[key] = item;
  }
  return Object.freeze(result);
}
