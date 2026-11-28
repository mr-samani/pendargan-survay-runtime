import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { AnswerStateSnapshot, AnswerValue, QuestionAnswerState } from '../state/answer-state.types';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';
import { validateScalarAnswer } from './scalar-answer-rules';

export interface ValidationIssue {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly questionId: string;
  readonly message: string;
}
export type QuestionValidationStatus = 'valid' | 'invalid' | 'skipped' | 'unknown';
export interface QuestionValidationResult {
  readonly questionId: string;
  readonly status: QuestionValidationStatus;
  readonly issues: readonly ValidationIssue[];
}
export interface SurveyValidationResult {
  readonly surveyId: string;
  readonly instanceId: string;
  readonly answerRevision: number;
  readonly questions: readonly QuestionValidationResult[];
  readonly issues: readonly ValidationIssue[];
  readonly isValid: boolean | null;
}
export interface SurveyValidationOptions {
  readonly validateHiddenQuestions?: boolean;
}

/** Pure validation projection shared by interactive navigation and final submission. */
export function validateSurveyAnswers(
  definition: SurveyDefinition,
  state: AnswerStateSnapshot,
  visibility: SurveyVisibilityResult,
  instanceId: string,
  options: SurveyValidationOptions = {},
): SurveyValidationResult {
  const issues: ValidationIssue[] = [];
  const results: QuestionValidationResult[] = [];

  if (state.surveyId !== definition.id || visibility.surveyId !== definition.id) {
    issues.push({
      code: 'VALIDATION_SURVEY_MISMATCH', severity: 'error', questionId: '',
      message: 'Definition, answer state, and visibility must belong to the same survey.',
    });
    return freezeResult({ surveyId: definition.id, instanceId, answerRevision: state.revision,
      questions: [], issues, isValid: false });
  }

  const instance = state.instances[instanceId];
  if (!instance) {
    issues.push({
      code: 'VALIDATION_INSTANCE_UNKNOWN', severity: 'error', questionId: '',
      message: 'The requested answer instance does not exist.',
    });
    return freezeResult({ surveyId: definition.id, instanceId, answerRevision: state.revision,
      questions: [], issues, isValid: false });
  }

  const visibilityByQuestion = new Map(visibility.questions.map((item) => [item.questionId, item.isVisible]));
  const knownQuestionIds = new Set(definition.questions.map((item) => item.id));
  for (const questionId of Object.keys(instance)) {
    if (!knownQuestionIds.has(questionId)) {
      issues.push({
        code: 'VALIDATION_UNKNOWN_QUESTION_STATE', severity: 'error', questionId,
        message: 'The answer instance contains a question not present in this definition.',
      });
    }
  }

  for (const question of definition.questions) {
    const answer = instance[question.id];
    if (!answer) continue;
    const visible = visibilityByQuestion.get(question.id) ?? null;
    const validateHidden = options.validateHiddenQuestions === true;

    if (!question.isActive || (!validateHidden && visible === false)) {
      results.push(questionResult(question.id, 'skipped', []));
      continue;
    }
    if (!validateHidden && visible === null) {
      results.push(questionResult(question.id, 'unknown', []));
      continue;
    }

    const questionIssues = validateQuestion(question, answer);
    issues.push(...questionIssues);
    results.push(questionResult(
      question.id,
      questionIssues.some((item) => item.severity === 'error') ? 'invalid' : 'valid',
      questionIssues,
    ));
  }

  const hasErrors = issues.some((item) => item.severity === 'error');
  const hasUnknown = results.some((item) => item.status === 'unknown');
  return freezeResult({
    surveyId: definition.id, instanceId, answerRevision: state.revision,
    questions: results, issues, isValid: hasErrors ? false : hasUnknown ? null : true,
  });
}

function validateQuestion(
  question: SurveyDefinition['questions'][number],
  answer: QuestionAnswerState,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const answered = hasAnswer(answer);

  if (question.isRequired && !answered) {
    issues.push({
      code: 'QUESTION_REQUIRED', severity: 'error', questionId: question.id,
      message: 'A response is required for this question.',
    });
  }

  const validOptionIds = new Set(question.options.map((option) => option.id));
  for (const optionId of answer.selectedOptionIds) {
    if (!validOptionIds.has(optionId)) {
      issues.push({
        code: 'ANSWER_OPTION_UNKNOWN', severity: 'error', questionId: question.id,
        message: 'The selected option "' + optionId + '" does not belong to this question.',
      });
    }
  }

  if (question.questionType === FormQuestionTypesEnum.FileUpload) {
    issues.push(...validateFileUploadAnswer(question, answer));
  }

  if (answered && isScalarQuestionType(question.questionType)) {
    const settings = question.settings ?? {};
    const validation = validateScalarAnswer(question.questionType, answer.value, {
      required: question.isRequired,
      minimum: question.minimumAnswer,
      maximum: question.maximumAnswer,
      pattern: typeof settings['maskRegEx'] === 'string' ? settings['maskRegEx'] : null,
      isDecimal: settings['isDecimal'] === true,
      maxDecimalDigit: typeof settings['maxDecimalDigit'] === 'number' ||
        typeof settings['maxDecimalDigit'] === 'string' ? settings['maxDecimalDigit'] : null,
      minimumDate: typeof settings['minDate'] === 'string' ? settings['minDate'] : null,
      maximumDate: typeof settings['maxDate'] === 'string' ? settings['maxDate'] : null,
    });
    if (validation) {
      const codeByRule: Record<string, string> = {
        required: 'QUESTION_REQUIRED',
        min: question.questionType === FormQuestionTypesEnum.Point ? 'POINT_ANSWER_OUT_OF_RANGE' : 'ANSWER_BELOW_MINIMUM',
        max: question.questionType === FormQuestionTypesEnum.Point ? 'POINT_ANSWER_OUT_OF_RANGE' : 'ANSWER_ABOVE_MAXIMUM',
        email: 'ANSWER_EMAIL_INVALID',
        mobile: 'ANSWER_MOBILE_INVALID',
        phone: 'ANSWER_PHONE_INVALID',
        'national-code': 'ANSWER_NATIONAL_CODE_INVALID',
        'decimal-precision': 'ANSWER_DECIMAL_PRECISION_EXCEEDED',
        'date-before-min': 'ANSWER_DATE_BEFORE_MINIMUM',
        'date-after-max': 'ANSWER_DATE_AFTER_MAXIMUM',
        invalid: question.questionType === FormQuestionTypesEnum.CustomMaskShortText
          ? 'ANSWER_CUSTOM_MASK_INVALID'
          : question.questionType === FormQuestionTypesEnum.Point
            ? 'POINT_ANSWER_NOT_NUMERIC'
            : 'ANSWER_SCALAR_INVALID',
      };
      issues.push({
        code: codeByRule[validation.code],
        severity: 'error',
        questionId: question.id,
        message: 'The answer does not satisfy the ' + validation.code + ' rule.',
      });
    }
  }
  return issues;
}

function validateFileUploadAnswer(
  question: SurveyDefinition['questions'][number],
  answer: QuestionAnswerState,
): ValidationIssue[] {
  const raw = answer.value;
  if (!Array.isArray(raw)) {
    return hasMeaningfulValue(raw) ? [{
      code: 'FILE_ANSWER_INVALID',
      severity: 'error',
      questionId: question.id,
      message: 'A file upload answer must be a list of uploaded file records.',
    }] : [];
  }

  const files = raw.map((item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? item as Readonly<Record<string, unknown>>
      : {},
  );
  if (files.length === 0 && !question.isRequired) return [];

  const settingsValue = question.source['fileUploadSettingDto'];
  const settings = settingsValue && typeof settingsValue === 'object' && !Array.isArray(settingsValue)
    ? settingsValue as Readonly<Record<string, unknown>>
    : {};
  const minCount = finiteSetting(settings['minFileCount']) ?? 0;
  const maxCount = finiteSetting(settings['maxFileCount']);
  const minSizeKb = finiteSetting(settings['minSize']);
  const maxSizeKb = finiteSetting(settings['maxSize']);
  const result: ValidationIssue[] = [];
  const add = (code: string, message: string) => result.push({
    code, severity: 'error', questionId: question.id, message,
  });

  if (files.length < minCount) add('FILE_COUNT_BELOW_MINIMUM', 'The uploaded file count is below the configured minimum.');
  if (maxCount !== null && files.length > maxCount) add('FILE_COUNT_ABOVE_MAXIMUM', 'The uploaded file count exceeds the configured maximum.');

  let completed = 0;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const size = finiteSetting(file['size']);
    const status = finiteSetting(file['status']);
    const fileState = finiteSetting(file['fileState']);
    const fileUniqueId = typeof file['fileUniqueId'] === 'string' ? file['fileUniqueId'].trim() : '';
    if (status === 2 || fileState === 1) {
      completed++;
      if (!fileUniqueId) add('FILE_ID_MISSING', 'An uploaded file is missing its server file identifier.');
    } else {
      add('FILE_UPLOAD_INCOMPLETE', 'Every selected file must finish uploading before submission.');
    }
    if (size !== null) {
      const sizeKb = Math.round(size / 1024);
      if (maxSizeKb !== null && sizeKb > maxSizeKb) add('FILE_SIZE_ABOVE_MAXIMUM', 'A file exceeds the configured maximum size.');
      if (minSizeKb !== null && sizeKb < minSizeKb) add('FILE_SIZE_BELOW_MINIMUM', 'A file is below the configured minimum size.');
    }
    const allowed = settings['extension'];
    if (typeof allowed === 'string' && allowed.trim() !== '') {
      const extension = typeof file['ext'] === 'string'
        ? file['ext'].toLowerCase()
        : typeof file['name'] === 'string' ? file['name'].split('.').pop()?.toLowerCase() ?? '' : '';
      const allowedExtensions = allowed.split(/[,،]/).map((item) => item.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
      if (!allowedExtensions.includes(extension)) add('FILE_EXTENSION_NOT_ALLOWED', 'A file extension is not allowed by this question.');
    }
  }
  if (files.length > 0 && completed === 0 && question.isRequired) {
    add('FILE_UPLOAD_REQUIRED', 'At least one file must be uploaded successfully.');
  }
  return result;
}

function finiteSetting(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isScalarQuestionType(type: FormQuestionTypesEnum | undefined): boolean {
  return type === FormQuestionTypesEnum.Point ||
    type === FormQuestionTypesEnum.Numeric ||
    type === FormQuestionTypesEnum.Email ||
    type === FormQuestionTypesEnum.Mobile ||
    type === FormQuestionTypesEnum.Phone ||
    type === FormQuestionTypesEnum.NationalCode ||
    type === FormQuestionTypesEnum.ShortText ||
    type === FormQuestionTypesEnum.LongText ||
    type === FormQuestionTypesEnum.CustomMaskShortText;
}

function hasAnswer(answer: QuestionAnswerState): boolean {
  return answer.selectedOptionIds.length > 0 || hasMeaningfulValue(answer.value);
}
function hasMeaningfulValue(value: AnswerValue): boolean {
  if (value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}
function questionResult(
  questionId: string, status: QuestionValidationStatus, issues: readonly ValidationIssue[],
): QuestionValidationResult {
  return Object.freeze({ questionId, status, issues: Object.freeze([...issues]) });
}
function freezeResult(value: SurveyValidationResult): SurveyValidationResult {
  for (const item of value.questions) Object.freeze(item);
  for (const item of value.issues) Object.freeze(item);
  Object.freeze(value.questions);
  Object.freeze(value.issues);
  return Object.freeze(value);
}
