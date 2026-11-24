import {
  CreateVoterAnswerDetailDto,
  FileVoterAnswerDetailsDto,
  FormQuestionTypesEnum,
} from '@service-proxies/models';
import type { SurveyOptionDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerValue, QuestionAnswerState } from '../state/answer-state.types';

export interface QuestionAnswerSerializationContext {
  /** Backend loop page's dynamic record ID, not the DynamicAnswer question's own answer ID. */
  readonly dynamicDataRecordId?: string | number;
  /** False when the question is hidden, ended, inactive in the current projection, or has no visible child/option. */
  readonly isVisible?: boolean;
  readonly isEndForm?: boolean;
  readonly hasVisibleQuestionOrOption?: boolean;
  /** When supplied, only these option IDs are eligible for serialization. */
  readonly visibleOptionIds?: readonly string[];
  /** Runtime-evaluated initial value. Falls back to the detached DTO snapshot. */
  readonly evaluatedInitialValue?: string;
}

export interface QuestionAnswerSerializationDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export class QuestionAnswerSerializationError extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'QuestionAnswerSerializationError';
  }
}

const DESCRIPTION_ALL_OPTIONS = 1;
const DESCRIPTION_LAST_OPTION = 2;
const DESCRIPTION_SELECTED_OPTION = 3;

/**
 * Mirrors ConverterDataService.getAnswerOfQuestion without mutating runtime state.
 * Question types which the legacy converter intentionally omitted return an empty list.
 */
export function serializeQuestionAnswer(
  question: SurveyQuestionDefinition,
  answer: QuestionAnswerState,
  context: QuestionAnswerSerializationContext = {},
): readonly CreateVoterAnswerDetailDto[] {
  if (answer.questionId !== question.id) {
    throw new QuestionAnswerSerializationError(
      'ANSWER_QUESTION_MISMATCH',
      question.id,
      'The answer state belongs to a different question.',
    );
  }

  const type = question.questionType;
  if (type === undefined) {
    throw new QuestionAnswerSerializationError(
      'QUESTION_TYPE_MISSING',
      question.id,
      'The question type is missing from the definition.',
    );
  }

  const isGroup = type === FormQuestionTypesEnum.Group;
  if (
    !isGroup &&
    (question.isActive === false ||
      context.isVisible === false ||
      context.isEndForm === true ||
      context.hasVisibleQuestionOrOption === false)
  ) {
    return [];
  }

  const initialValue = context.evaluatedInitialValue ??
    optionalString(question.source['evaluateInitialValue']);
  const common = {
    formQuestionUniqueId: requiredBackendId(question.sourceId ?? optionalString(question.source['uniqueId']), question.id),
    dynamicDataRecordId: numericId(context.dynamicDataRecordId, question.id + '.dynamicDataRecordId'),
    formQuestionInitialValue: initialValue,
  };

  switch (type) {
    case FormQuestionTypesEnum.UniqueSelect:
    case FormQuestionTypesEnum.Dropdown:
    case FormQuestionTypesEnum.MultiSelect:
    case FormQuestionTypesEnum.Matrix_Radio:
    case FormQuestionTypesEnum.Matrix_Checkbox:
    case FormQuestionTypesEnum.Matrix_MultiShortText:
    case FormQuestionTypesEnum.Matrix_MultiNumeric:
    case FormQuestionTypesEnum.Emoji:
    case FormQuestionTypesEnum.UniqueSelectWithImageOptions:
    case FormQuestionTypesEnum.MultiSelectWithImageOptions: {
      const selected = new Set(answer.selectedOptionIds);
      const visible = context.visibleOptionIds ? new Set(context.visibleOptionIds) : undefined;
      const selectedOptions = question.options.filter((option) =>
        selected.has(option.id) &&
        option.source['dontShow'] !== true &&
        (!visible || visible.has(option.id)),
      );
      return selectedOptions.map((option) => new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: requiredBackendId(option.sourceId ?? optionalString(option.source['uniqueId']), question.id + '.options.' + option.id),
        answerTitle: option.title ?? optionalString(option.source['title']) ?? '',
        answerDescription: getOptionDescription(question, option, answer.value, type),
        files: [],
        orderAnswer: undefined,
        validationGuid: '',
      }));
    }

    case FormQuestionTypesEnum.HasPriority: {
      const ids = priorityIds(answer.value, answer.selectedOptionIds);
      return ids.flatMap((optionId, index) => {
        const option = question.options.find((item) => item.id === optionId);
        if (!option) return [];
        return [new CreateVoterAnswerDetailDto({
          ...common,
          questionOptionUniqueId: requiredBackendId(option.sourceId ?? optionalString(option.source['uniqueId']), question.id + '.options.' + option.id),
          answerTitle: option.title ?? optionalString(option.source['title']) ?? '',
          answerDescription: getOptionDescription(question, option, answer.value, type),
          orderAnswer: index + 1,
          files: [],
          validationGuid: '',
        })];
      });
    }

    case FormQuestionTypesEnum.SkuCount:
      return skuRows(answer.value, question.id).map((sku) => new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: optionalString(sku['questionOptionUniqueId']) ?? '',
        answerTitle: optionalString(sku['answerTitle']) ?? '',
        answerDescription: stringifyNumber(sku['total']),
        files: [],
        orderAnswer: undefined,
        validationGuid: '',
      }));

    case FormQuestionTypesEnum.SkuCount_Dynamic:
      return skuRows(answer.value, question.id).map((sku) => new CreateVoterAnswerDetailDto({
        ...common,
        dynamicDataRecordId: numericId(sku['identificationCode'], question.id + '.selectedList.identificationCode'),
        questionOptionUniqueId: '',
        answerTitle: optionalString(sku['answerTitle']) ?? '',
        answerDescription: stringifyNumber(sku['total']),
        files: [],
        orderAnswer: undefined,
        validationGuid: '',
      }));

    case FormQuestionTypesEnum.Point:
    case FormQuestionTypesEnum.Rating:
    case FormQuestionTypesEnum.Numeric:
    case FormQuestionTypesEnum.Date:
    case FormQuestionTypesEnum.Time:
    case FormQuestionTypesEnum.Email:
    case FormQuestionTypesEnum.Mobile:
    case FormQuestionTypesEnum.NationalCode:
    case FormQuestionTypesEnum.Phone:
    case FormQuestionTypesEnum.ShortText:
    case FormQuestionTypesEnum.LongText:
    case FormQuestionTypesEnum.Location:
    case FormQuestionTypesEnum.PostalCode:
    case FormQuestionTypesEnum.CustomMaskShortText:
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        answerTitle: '',
        answerDescription: answerString(answer.value),
        validationGuid: question.source['hasVerification'] === true
          ? optionalString(valueRecord(answer.value)['validationGuid']) ?? ''
          : '',
        files: [],
        orderAnswer: undefined,
      })];

    case FormQuestionTypesEnum.Point_NumericScale:
    case FormQuestionTypesEnum.NPS: {
      const settings = record(question.settings);
      const showNoComment = settings['showNoCommentOption'] === true && settings['noComment'] === true;
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        answerTitle: showNoComment
          ? optionalString(settings['noCommentOptionText']) ?? 'NoComment'
          : '',
        answerDescription: answerString(answer.value),
        files: [],
        orderAnswer: undefined,
        validationGuid: '',
      })];
    }

    case FormQuestionTypesEnum.DynamicAnswer: {
      const value = valueRecord(answer.value);
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        dynamicDataRecordId: numericId(value['identificationCode'], question.id + '.value.identificationCode'),
        answerTitle: optionalString(value['answerTitle']) ?? '',
        answerDescription: '',
        files: [],
        orderAnswer: undefined,
        validationGuid: '',
      })];
    }

    case FormQuestionTypesEnum.VoiceRecord:
    case FormQuestionTypesEnum.FileUpload: {
      const files = arrayValue(answer.value, question.id + '.files').map((file, index) => {
        const item = record(file);
        const fileUniqueId = optionalString(item['fileUniqueId']);
        if (!fileUniqueId) {
          throw new QuestionAnswerSerializationError(
            'ANSWER_FILE_ID_MISSING',
            question.id + '.files[' + index + ']',
            'A saved file answer must contain fileUniqueId.',
          );
        }
        return new FileVoterAnswerDetailsDto({ fileUniqueId, order: index });
      });
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        answerTitle: '',
        answerDescription: '',
        files,
        orderAnswer: undefined,
        validationGuid: '',
      })];
    }

    case FormQuestionTypesEnum.Captcha: {
      const value = valueRecord(answer.value);
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        answerTitle: '',
        answerDescription: optionalString(value['validationKey']) ?? '',
        validationGuid: optionalString(value['answer']) ?? optionalString(value['validationGuid']) ?? '',
        files: [],
        orderAnswer: undefined,
      })];
    }

    case FormQuestionTypesEnum.Payment: {
      const value = valueRecord(answer.value);
      const amount = record(question.settings)['amount'];
      return [new CreateVoterAnswerDetailDto({
        ...common,
        questionOptionUniqueId: '',
        answerTitle: amount === null || amount === undefined ? '' : String(amount),
        answerDescription: optionalString(value['validationKey']) ?? '',
        validationGuid: optionalString(value['answer']) ?? optionalString(value['validationGuid']) ?? '',
        files: [],
        orderAnswer: undefined,
      })];
    }

    case FormQuestionTypesEnum.Group:
      return [new CreateVoterAnswerDetailDto({
        formQuestionUniqueId: requiredBackendId(question.sourceId ?? optionalString(question.source['uniqueId']), question.id),
        dynamicDataRecordId: undefined,
        questionOptionUniqueId: '',
        answerTitle: '',
        answerDescription: answerString(answer.value),
        orderAnswer: 0,
        files: [],
        validationGuid: '',
        formQuestionInitialValue: initialValue,
      })];

    // The legacy converter intentionally emits no direct answer row for these
    // container/content question types. Matrix child questions serialize separately.
    case FormQuestionTypesEnum.Matrix:
    case FormQuestionTypesEnum.Matrix_Dynamic:
    case FormQuestionTypesEnum.HtmlFrame:
    case FormQuestionTypesEnum.Chart:
    case FormQuestionTypesEnum.RetailAudit:
    case FormQuestionTypesEnum.RecordsOtherForms:
    case FormQuestionTypesEnum.OpenPopUpSection:
      return [];

    default:
      throw new QuestionAnswerSerializationError(
        'QUESTION_TYPE_NOT_IMPLEMENTED',
        question.id,
        'No verified answer conversion exists for question type ' + type + '.',
      );
  }
}

function getOptionDescription(
  question: SurveyQuestionDefinition,
  option: SurveyOptionDefinition,
  answerValue: AnswerValue,
  type: FormQuestionTypesEnum,
): string {
  if (question.source['hasDescription'] !== true) return '';
  const value = valueRecord(answerValue);
  if (type === FormQuestionTypesEnum.MultiSelect) {
    const descriptions = record(value['optionDescriptions']);
    return optionalString(descriptions[option.id]) ?? '';
  }
  const description = optionalString(value['descriptionAnswer']) ?? '';
  const descriptionType = Number(question.source['descriptionType']);
  if (descriptionType === DESCRIPTION_ALL_OPTIONS) return description;
  if (descriptionType === DESCRIPTION_SELECTED_OPTION && option.source['hasDescriptiveAnswer'] === true) {
    return description;
  }
  if (descriptionType === DESCRIPTION_LAST_OPTION && question.options.at(-1)?.id === option.id) {
    return description;
  }
  return '';
}

function priorityIds(value: AnswerValue, selectedOptionIds: readonly string[]): readonly string[] {
  if (typeof value === 'string') {
    return value.split(/[،,]/).filter((item) => item !== '' && item !== 'null' && item !== 'undefined');
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return selectedOptionIds;
}

function skuRows(value: AnswerValue, questionId: string): readonly Readonly<Record<string, AnswerValue>>[] {
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new QuestionAnswerSerializationError(
      'ANSWER_SKU_LIST_INVALID',
      questionId + '.value',
      'SKU answers must be represented as an array of selected SKU records.',
    );
  }
  return value.map((item, index) => {
    if (item === null || Array.isArray(item) || typeof item !== 'object') {
      throw new QuestionAnswerSerializationError(
        'ANSWER_SKU_ITEM_INVALID',
        questionId + '.value[' + index + ']',
        'Each SKU answer must be a JSON object.',
      );
    }
    return item as Readonly<Record<string, AnswerValue>>;
  });
}

function numericId(value: unknown, path: string): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new QuestionAnswerSerializationError(
    'ANSWER_DYNAMIC_RECORD_ID_NOT_NUMERIC',
    path,
    'The generated API DTO declares dynamicDataRecordId as a number, but the source answer contains a non-numeric identifier.',
  );
}

function requiredBackendId(value: string | undefined, path: string): string {
  const result = value;
  if (!result) {
    throw new QuestionAnswerSerializationError(
      'BACKEND_QUESTION_ID_MISSING',
      path,
      'The backend question/option unique ID is missing.',
    );
  }
  return result;
}
function stringifyNumber(value: AnswerValue | undefined): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return value === null || value === undefined ? '' : String(value);
}
function answerString(value: AnswerValue): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return '';
  const object = valueRecord(value);
  return optionalString(object['answer']) ?? optionalString(object['value']) ?? '';
}
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function valueRecord(value: AnswerValue): Readonly<Record<string, AnswerValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, AnswerValue>>
    : {};
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}
function arrayValue(value: AnswerValue, path: string): readonly AnswerValue[] {
  if (value === null) return [];
  if (!Array.isArray(value)) {
    throw new QuestionAnswerSerializationError(
      'ANSWER_FILE_LIST_INVALID',
      path,
      'File answers must be represented as an array.',
    );
  }
  return value;
}
