import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { LegacyQuestionVariableIndex } from './legacy-question-variable-index';

export interface LegacyGlobalVariableQuestionEffects {
  readonly questionId: string;
  readonly answerValue?: string;
  readonly evaluateInitialValue?: string;
  readonly paymentAmount?: number;
  readonly secondaryFieldValueFilter?: string;
  readonly shouldRecalculateAnswer: boolean;
  readonly shouldTriggerDynamicFilter: boolean;
}

/**
 * Projects the answer/Payment/secondary-filter side effects of the archived
 * setGlobalVariableInInitialValues method. It returns commands/data only; it does
 * not mutate the immutable definition or dispatch answer-state commands itself.
 */
export function projectLegacyGlobalVariableQuestionEffects(
  question: SurveyQuestionDefinition,
  variableTitle: string,
  variableResult: unknown,
  isReset = false,
): LegacyGlobalVariableQuestionEffects {
  const token = '[%' + variableTitle + '%]';
  const replacement = isNullOrEmpty(variableResult) ? '' : String(variableResult);
  const hasInitialValue = question.source['hasInitialValue'] === true;
  const initialValue = question.initialValue;
  const secondaryFilter = readString(question.source, 'secondaryFilterValue');
  const previousSecondaryFilter = readString(question.source, 'secondaryFieldValueFilter');

  let answerValue: string | undefined;
  let evaluateInitialValue: string | undefined;
  let paymentAmount: number | undefined;
  let secondaryFieldValueFilter: string | undefined;
  let shouldRecalculateAnswer = false;
  let shouldTriggerDynamicFilter = false;

  if (initialValue && hasInitialValue && initialValue.includes(token)) {
    const value = initialValue.split(token).join(replacement);
    if (!value.startsWith('[%')) {
      if (question.questionType === FormQuestionTypesEnum.Payment) {
        paymentAmount = Number.isInteger(+value) ? +value : 0;
      } else {
        answerValue = value;
      }
      evaluateInitialValue = value;
    }
    // The archived service calls changeAnswer even when another variable token
    // remains unresolved and no concrete answer value can be assigned.
    shouldRecalculateAnswer = true;
  }

  if (secondaryFilter && secondaryFilter.includes(token)) {
    if (!isReset && (
      question.questionType === FormQuestionTypesEnum.SkuCount_Dynamic ||
      question.questionType === FormQuestionTypesEnum.RetailAudit
    )) {
      const value = secondaryFilter.split(token).join(replacement);
      if (value !== previousSecondaryFilter && !value.startsWith('[%')) {
        secondaryFieldValueFilter = value;
        shouldTriggerDynamicFilter = true;
      }
    }
    // Legacy calls changeAnswer whenever secondaryFilterValue is configured.
    shouldRecalculateAnswer = true;
  }

  return Object.freeze({
    questionId: question.id,
    answerValue,
    evaluateInitialValue,
    paymentAmount,
    secondaryFieldValueFilter,
    shouldRecalculateAnswer,
    shouldTriggerDynamicFilter,
  });
}


/**
 * Applies the question-reference index in definition order and projects effects
 * only for questions that actually reference this global-variable token.
 */
export function projectLegacyGlobalVariableEffectsForSurvey(
  definition: SurveyDefinition,
  index: LegacyQuestionVariableIndex,
  variableTitle: string,
  variableResult: unknown,
  isReset = false,
): readonly LegacyGlobalVariableQuestionEffects[] {
  const token = '[%' + variableTitle + '%]';
  const effects: LegacyGlobalVariableQuestionEffects[] = [];
  for (const question of definition.questions) {
    const sourceId = question.sourceId;
    if (!sourceId || !index.variablesByQuestionSourceId[sourceId]?.includes(token)) continue;
    const effect = projectLegacyGlobalVariableQuestionEffects(
      question, variableTitle, variableResult, isReset,
    );
    if (effect.shouldRecalculateAnswer || effect.shouldTriggerDynamicFilter) {
      effects.push(effect);
    }
  }
  return Object.freeze(effects);
}

function isNullOrEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}
function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
