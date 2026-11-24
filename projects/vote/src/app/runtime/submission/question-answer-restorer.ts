import {
  FormQuestionTypesEnum,
  GetFormQuestionAnswerDto,
} from '@service-proxies/models';
import type { SurveyQuestionDefinition } from '../definition/definition.types';
import type { AnswerValue, QuestionAnswerState } from '../state/answer-state.types';

export interface QuestionAnswerRestoreDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}
export interface QuestionAnswerRestoreResult {
  readonly answer: QuestionAnswerState;
  readonly diagnostics: readonly QuestionAnswerRestoreDiagnostic[];
  readonly hasSavedAnswer: boolean;
  readonly shouldClearEditableInitialValue: boolean;
}

const SCALAR_TYPES = new Set<FormQuestionTypesEnum>([
  FormQuestionTypesEnum.ShortText,
  FormQuestionTypesEnum.LongText,
  FormQuestionTypesEnum.Date,
  FormQuestionTypesEnum.Time,
  FormQuestionTypesEnum.Email,
  FormQuestionTypesEnum.Mobile,
  FormQuestionTypesEnum.NationalCode,
  FormQuestionTypesEnum.Phone,
  FormQuestionTypesEnum.Numeric,
  FormQuestionTypesEnum.Point,
  FormQuestionTypesEnum.Rating,
  FormQuestionTypesEnum.NPS,
  FormQuestionTypesEnum.Point_NumericScale,
  FormQuestionTypesEnum.Location,
  FormQuestionTypesEnum.PostalCode,
  FormQuestionTypesEnum.CustomMaskShortText,
]);

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
 * Restores one question from the server DTO into the immutable runtime answer shape.
 * The mapping follows the original ConverterDataService.setAnswerInQuestions behavior.
 */
export function restoreQuestionAnswer(
  question: SurveyQuestionDefinition,
  saved: GetFormQuestionAnswerDto,
  revision = 0,
): QuestionAnswerRestoreResult {
  const diagnostics: QuestionAnswerRestoreDiagnostic[] = [];
  const rows = saved.voterAnswerDetailDto ?? [];
  const type = question.questionType;
  if (type === undefined) {
    return failure(question, revision, 'RESTORE_QUESTION_TYPE_MISSING',
      'The question type is missing from the definition.');
  }
  if (question.sourceId && saved.uniqueId && question.sourceId !== saved.uniqueId) {
    return failure(question, revision, 'RESTORE_QUESTION_ID_MISMATCH',
      'The saved question ID does not match the definition question ID.');
  }

  const first = rows[0];
  let value: AnswerValue = null;
  let selectedOptionIds: string[] = [];

  if (CHOICE_TYPES.has(type)) {
    const byBackendId = new Map(question.options.map((option) => [
      option.sourceId ?? optionalString(option.source['uniqueId']) ?? '',
      option,
    ]));
    const optionDescriptions: Record<string, AnswerValue> = {};
    for (const row of rows) {
      const optionId = row.questionOptionUniqueId ?? '';
      const option = byBackendId.get(optionId);
      if (!option) {
        diagnostics.push({
          code: 'RESTORE_OPTION_NOT_IN_DEFINITION',
          severity: 'warning',
          path: question.id + '.' + optionId,
          message: 'A saved option is no longer present in the current question definition.',
        });
        continue;
      }
      selectedOptionIds.push(option.id);
      if (type === FormQuestionTypesEnum.MultiSelect && row.answerDescription) {
        optionDescriptions[option.id] = row.answerDescription;
      }
    }

    if (type === FormQuestionTypesEnum.HasPriority) {
      // The legacy model rebuilds answer by iterating the server rows in their supplied order.
      const orderedIds = selectedOptionIds.join(',');
      value = question.source['hasDescription'] === true || saved.hasDescription === true
        ? { answer: orderedIds, descriptionAnswer: rows.find((row) => !!row.answerDescription)?.answerDescription ?? '' }
        : orderedIds;
    } else if (question.source['hasDescription'] === true || saved.hasDescription === true) {
      const sharedDescription = rows.find((row) => !!row.answerDescription)?.answerDescription ?? '';
      value = {
        descriptionAnswer: sharedDescription,
        optionDescriptions,
      };
    }
  } else {
    switch (type) {
      case FormQuestionTypesEnum.ShortText:
      case FormQuestionTypesEnum.LongText:
      case FormQuestionTypesEnum.Date:
      case FormQuestionTypesEnum.Time:
      case FormQuestionTypesEnum.Email:
      case FormQuestionTypesEnum.Mobile:
      case FormQuestionTypesEnum.NationalCode:
      case FormQuestionTypesEnum.Phone:
      case FormQuestionTypesEnum.Numeric:
      case FormQuestionTypesEnum.Point:
      case FormQuestionTypesEnum.Rating:
      case FormQuestionTypesEnum.NPS:
      case FormQuestionTypesEnum.Point_NumericScale:
      case FormQuestionTypesEnum.Location:
      case FormQuestionTypesEnum.PostalCode:
      case FormQuestionTypesEnum.CustomMaskShortText: {
        value = first?.answerDescription ?? null;
        if (value !== null && (question.source['hasDescription'] === true || saved.hasDescription === true)) {
          value = {
            value,
            descriptionAnswer: rows.find((row) => !!row.answerDescription)?.answerDescription ?? '',
          };
        }
        break;
      }

      case FormQuestionTypesEnum.FileUpload: {
        const files = (first?.files ?? []).flatMap((fileDetail) => {
          const file = fileDetail.file;
          if (!file) return [];
          return [{
            fileId: file.id ?? null,
            fileUniqueId: file.uniqueId ?? '',
            name: file.fileName ?? '',
            size: file.size ?? 0,
            humanSize: String(file.size ?? 0),
            ext: file.extension ?? '',
            fileType: file.contentType ?? '',
            addressUrl: file.addressUrl ?? file.address ?? '',
            progress: 100,
          } satisfies Record<string, AnswerValue>];
        });
        value = files;
        break;
      }

      case FormQuestionTypesEnum.DynamicAnswer:
        value = first ? {
          identificationCode: first.dynamicDataRecordId ?? null,
          id: first.dynamicDataRecordId ?? null,
          answerTitle: first.answerTitle ?? '',
          jsonValuesDictionary: stringRecord(first.jsonValuesDictionary),
        } : null;
        break;

      case FormQuestionTypesEnum.SkuCount:
      case FormQuestionTypesEnum.SkuCount_Dynamic: {
        const dynamicDataUniqueId = optionalString(question.source['dynamicDataUniqueId']) ?? '';
        value = rows.map((row) => {
          const parsedTotal = Number(row.answerDescription ?? 0);
          if (!Number.isFinite(parsedTotal)) {
            diagnostics.push({
              code: 'RESTORE_SKU_TOTAL_INVALID',
              severity: 'error',
              path: question.id + '.answerDescription',
              message: 'A saved SKU total is not a finite number.',
            });
          }
          return {
            identificationCode: row.dynamicDataRecordId ?? 0,
            questionOptionUniqueId: row.questionOptionUniqueId ?? '',
            answerTitle: row.answerTitle ?? '',
            quantity: 1,
            total: Number.isFinite(parsedTotal) ? parsedTotal : 0,
            history: [],
            ordering: 0,
            dynamicDataUniqueId,
            answerTitleLower: (row.answerTitle ?? '').toLowerCase(),
            answerTitleLowerNoSpace: (row.answerTitle ?? '').toLowerCase().replace(/ /g, ''),
            jsonValuesDictionary: {},
            retaliVariables: {},
            questionChilds: [],
          };
        });
        break;
      }

      case FormQuestionTypesEnum.Captcha:
      case FormQuestionTypesEnum.Payment:
        value = first ? {
          validationKey: first.answerDescription ?? '',
          answer: first.validationGuid ?? '',
          validationGuid: first.validationGuid ?? '',
        } : null;
        break;

      case FormQuestionTypesEnum.RetailAudit:
        diagnostics.push({
          code: 'RESTORE_RETAIL_AUDIT_REQUIRES_SECTION_CONTEXT',
          severity: 'warning',
          path: question.id,
          message: 'RetailAudit restoration needs all repeated section pages and child questions; use the section-level RetailAudit adapter.',
        });
        break;

      // The original restore switch does not assign direct answer values for these containers.
      case FormQuestionTypesEnum.Matrix:
      case FormQuestionTypesEnum.Matrix_Dynamic:
      case FormQuestionTypesEnum.HtmlFrame:
      case FormQuestionTypesEnum.Chart:
      case FormQuestionTypesEnum.RecordsOtherForms:
      case FormQuestionTypesEnum.OpenPopUpSection:
      case FormQuestionTypesEnum.Group:
        break;

      default:
        diagnostics.push({
          code: 'RESTORE_QUESTION_TYPE_UNSUPPORTED',
          severity: 'warning',
          path: question.id,
          message: 'No verified saved-answer restore mapping exists for question type ' + type + '.',
        });
        break;
    }
  }

  const hasSavedAnswer = rows.length > 0;
  const hasInitialValue = question.source['hasInitialValue'] === true;
  const isEditableInitialValue = question.source['isEditableInitialValue'] === true;
  const hasNonEmptyRestoredValue = value !== null &&
    !(typeof value === 'string' && value.length === 0) &&
    !(Array.isArray(value) && value.length === 0);
  const shouldClearEditableInitialValue = hasSavedAnswer && SCALAR_TYPES.has(type) &&
    hasInitialValue && isEditableInitialValue && hasNonEmptyRestoredValue;
  const answer: QuestionAnswerState = Object.freeze({
    questionId: question.id,
    value: deepFreeze(value),
    selectedOptionIds: Object.freeze(selectedOptionIds),
    isDirty: false,
    shouldClearEditableInitialValue,
    updatedAtRevision: revision,
  });

  for (const item of diagnostics) Object.freeze(item);
  return Object.freeze({
    answer,
    diagnostics: Object.freeze(diagnostics),
    hasSavedAnswer,
    shouldClearEditableInitialValue,
  });
}

function failure(
  question: SurveyQuestionDefinition,
  revision: number,
  code: string,
  message: string,
): QuestionAnswerRestoreResult {
  const diagnostic = Object.freeze({
    code, severity: 'error' as const, path: question.id, message,
  });
  return Object.freeze({
    answer: Object.freeze({
      questionId: question.id,
      value: null,
      selectedOptionIds: Object.freeze([]),
      isDirty: false,
      updatedAtRevision: revision,
    }),
    diagnostics: Object.freeze([diagnostic]),
    hasSavedAnswer: false,
    shouldClearEditableInitialValue: false,
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function stringRecord(value: Record<string, string> | null | undefined): Record<string, AnswerValue> {
  const result: Record<string, AnswerValue> = {};
  for (const [key, item] of Object.entries(value ?? {})) result[key] = item;
  return result;
}
function deepFreeze(value: AnswerValue): AnswerValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => deepFreeze(item)));
  }
  const result: Record<string, AnswerValue> = {};
  for (const [key, item] of Object.entries(value)) result[key] = deepFreeze(item);
  return Object.freeze(result);
}
