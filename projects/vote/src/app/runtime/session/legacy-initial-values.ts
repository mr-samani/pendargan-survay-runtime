import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { hydrateAnswerInstance } from '../state/answer-state.reducer';
import type { AnswerCommandResult, AnswerStateSnapshot } from '../state/answer-state.types';

/**
 * Applies only the initial answer values that the archived initializeQuestions
 * pass assigned before its first formula run. Formula-backed values beginning
 * with [% are deliberately initialized as an empty string and are resolved
 * later by the global-variable compatibility pipeline.
 *
 * This helper does not infer defaults for other question types (Point, Group,
 * FileUpload, HasPriority, etc.); those have separate legacy initialization
 * rules and must be projected by their own adapters.
 */
export function initializeLegacyQuestionInitialValues(
  definition: SurveyDefinition,
  answers: AnswerStateSnapshot,
  instanceId = 'root',
): AnswerCommandResult {
  if (answers.surveyId !== definition.id) {
    return {
      state: answers,
      applied: false,
      changedAnswers: [],
      diagnostics: [{
        code: 'LEGACY_INITIAL_VALUES_SURVEY_MISMATCH',
        severity: 'error',
        path: 'surveyId',
        message: 'Definition and answer state belong to different surveys.',
      }],
    };
  }

  const instance = answers.instances[instanceId];
  if (!instance) {
    return {
      state: answers,
      applied: false,
      changedAnswers: [],
      diagnostics: [{
        code: 'LEGACY_INITIAL_VALUES_INSTANCE_UNKNOWN',
        severity: 'error',
        path: instanceId,
        message: 'The answer instance does not exist.',
      }],
    };
  }

  const restoredAnswers = definition.questions
    .filter((question) =>
      question.isActive &&
      question.questionType !== FormQuestionTypesEnum.Group &&
      question.source['hasInitialValue'] === true &&
      typeof question.initialValue === 'string' &&
      question.initialValue.length > 0,
    )
    .map((question) => ({
      questionId: question.id,
      value: question.initialValue!.startsWith('[%') ? '' : question.initialValue!,
      selectedOptionIds: instance[question.id]?.selectedOptionIds ?? [],
    }));

  return hydrateAnswerInstance(definition, answers, instanceId, restoredAnswers);
}
