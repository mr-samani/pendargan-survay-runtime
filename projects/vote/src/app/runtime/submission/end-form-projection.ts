import { ExpressionActionsEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { ProposedSurveyAction } from '../definition/full-evaluator';

/**
 * The legacy EndForm/SubmitForm action keeps its trigger question visible and
 * marks every following question as ended. Multiple active triggers resolve to
 * the earliest question in the original form order.
 */
export function resolveEndedQuestionIds(
  definition: SurveyDefinition,
  actions: readonly ProposedSurveyAction[],
): ReadonlySet<string> {
  let firstTriggerIndex = Number.POSITIVE_INFINITY;
  for (const action of actions) {
    if (!action.conditionMet ||
        (action.actionType !== ExpressionActionsEnum.EndForm &&
          action.actionType !== ExpressionActionsEnum.SubmitForm) ||
        !action.formQuestionUniqueId) continue;
    const triggerIndex = definition.questions.findIndex((question) =>
      question.id === action.formQuestionUniqueId ||
      question.sourceId === action.formQuestionUniqueId ||
      question.uniqueIdPerForm === action.formQuestionUniqueId);
    if (triggerIndex >= 0 && triggerIndex < firstTriggerIndex) firstTriggerIndex = triggerIndex;
  }
  if (!Number.isFinite(firstTriggerIndex)) return new Set<string>();
  return new Set(definition.questions.slice(firstTriggerIndex + 1).map((question) => question.id));
}
