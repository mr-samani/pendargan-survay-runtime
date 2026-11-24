import type { SurveyDefinition } from '../definition/definition.types';
import type { AnswerCommand } from '../state/answer-state.types';
import type { LegacyQuestionVariableIndex } from './legacy-question-variable-index';
import {
  projectLegacyGlobalVariableEffectsForSurvey,
  type LegacyGlobalVariableQuestionEffects,
} from './legacy-global-variable-effects';

export interface EvaluatedLegacyGlobalVariable {
  readonly id: string;
  readonly value: unknown;
}

export interface LegacyPaymentAmountOverride {
  readonly questionId: string;
  readonly amount: number;
}

export interface LegacySecondaryFilterUpdate {
  readonly questionId: string;
  readonly value: string;
}

export interface LegacyGlobalVariableEffectBatch {
  readonly changedVariableIds: readonly string[];
  readonly answerCommands: readonly AnswerCommand[];
  readonly paymentAmountOverrides: readonly LegacyPaymentAmountOverride[];
  readonly secondaryFilterUpdates: readonly LegacySecondaryFilterUpdate[];
  readonly questionsToRecalculate: readonly string[];
  readonly sourceEffects: readonly LegacyGlobalVariableQuestionEffects[];
}

/**
 * Converts changed global-variable results into immutable, instance-scoped
 * answer commands and explicit non-answer effects.
 *
 * Previous values are supplied by the owning session so repeated-section
 * instances can independently receive their initial-value effects.
 */
export function buildLegacyGlobalVariableEffectBatch(
  definition: SurveyDefinition,
  index: LegacyQuestionVariableIndex,
  evaluated: readonly EvaluatedLegacyGlobalVariable[],
  previousValuesById: Readonly<Record<string, unknown>>,
  instanceId: string,
  isReset = false,
): LegacyGlobalVariableEffectBatch {
  const answerCommands: AnswerCommand[] = [];
  const paymentAmountOverrides: LegacyPaymentAmountOverride[] = [];
  const secondaryFilterUpdates: LegacySecondaryFilterUpdate[] = [];
  const questionsToRecalculate = new Set<string>();
  const changedVariableIds: string[] = [];
  const sourceEffects: LegacyGlobalVariableQuestionEffects[] = [];

  for (const result of evaluated) {
    const variable = definition.globalVariables.find((item) => item.id === result.id);
    if (!variable || !variable.isActive) continue;
    if (Object.prototype.hasOwnProperty.call(previousValuesById, result.id) &&
        Object.is(previousValuesById[result.id], result.value)) {
      continue;
    }

    changedVariableIds.push(result.id);
    const effects = projectLegacyGlobalVariableEffectsForSurvey(
      definition, index, variable.title, result.value, isReset,
    );

    for (const effect of effects) {
      sourceEffects.push(effect);
      if (effect.answerValue !== undefined) {
        answerCommands.push({
          type: 'set-value',
          instanceId,
          questionId: effect.questionId,
          value: effect.answerValue,
        });
      }
      if (effect.paymentAmount !== undefined) {
        paymentAmountOverrides.push(Object.freeze({
          questionId: effect.questionId,
          amount: effect.paymentAmount,
        }));
      }
      if (effect.secondaryFieldValueFilter !== undefined) {
        secondaryFilterUpdates.push(Object.freeze({
          questionId: effect.questionId,
          value: effect.secondaryFieldValueFilter,
        }));
      }
      if (effect.shouldRecalculateAnswer) questionsToRecalculate.add(effect.questionId);
    }
  }

  return Object.freeze({
    changedVariableIds: Object.freeze(changedVariableIds),
    answerCommands: Object.freeze(answerCommands),
    paymentAmountOverrides: Object.freeze(paymentAmountOverrides),
    secondaryFilterUpdates: Object.freeze(secondaryFilterUpdates),
    questionsToRecalculate: Object.freeze([...questionsToRecalculate]),
    sourceEffects: Object.freeze(sourceEffects),
  });
}
