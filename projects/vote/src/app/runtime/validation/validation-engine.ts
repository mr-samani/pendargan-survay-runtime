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
