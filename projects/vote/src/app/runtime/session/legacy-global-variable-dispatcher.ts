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
  availableQuestionIds?: ReadonlySet<string>,
  previousRuntimeState: LegacyGlobalVariableRuntimeState = EMPTY_LEGACY_GLOBAL_VARIABLE_RUNTIME_STATE,
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
      previousRuntimeState.secondaryFilters,
    );

    for (const effect of effects) {
      if (availableQuestionIds && !availableQuestionIds.has(effect.questionId)) continue;
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


export interface LegacyGlobalVariableRuntimeState {
  readonly paymentAmounts: Readonly<Record<string, number>>;
  readonly secondaryFilters: Readonly<Record<string, string>>;
}

export const EMPTY_LEGACY_GLOBAL_VARIABLE_RUNTIME_STATE: LegacyGlobalVariableRuntimeState =
  Object.freeze({
    paymentAmounts: Object.freeze({}),
    secondaryFilters: Object.freeze({}),
  });

/** Persists non-answer effects so a later unchanged evaluation does not erase them. */
export function applyLegacyGlobalVariableEffectBatchToState(
  previous: LegacyGlobalVariableRuntimeState = EMPTY_LEGACY_GLOBAL_VARIABLE_RUNTIME_STATE,
  batch: LegacyGlobalVariableEffectBatch,
): LegacyGlobalVariableRuntimeState {
  const paymentAmounts: Record<string, number> = { ...previous.paymentAmounts };
  const secondaryFilters: Record<string, string> = { ...previous.secondaryFilters };

  for (const item of batch.paymentAmountOverrides) {
    paymentAmounts[item.questionId] = item.amount;
  }
  for (const item of batch.secondaryFilterUpdates) {
    secondaryFilters[item.questionId] = item.value;
  }

  return Object.freeze({
    paymentAmounts: Object.freeze(paymentAmounts),
    secondaryFilters: Object.freeze(secondaryFilters),
  });
}

/** Combines side effects produced by successive fixed-point evaluation passes. */
export function mergeLegacyGlobalVariableEffectBatches(
  batches: readonly LegacyGlobalVariableEffectBatch[],
): LegacyGlobalVariableEffectBatch {
  const changedVariableIds = new Set<string>();
  const answerCommands: AnswerCommand[] = [];
  const paymentAmounts = new Map<string, LegacyPaymentAmountOverride>();
  const secondaryFilters = new Map<string, LegacySecondaryFilterUpdate>();
  const questionsToRecalculate = new Set<string>();
  const sourceEffects: LegacyGlobalVariableQuestionEffects[] = [];

  for (const batch of batches) {
    for (const id of batch.changedVariableIds) changedVariableIds.add(id);
    answerCommands.push(...batch.answerCommands);
    for (const item of batch.paymentAmountOverrides) paymentAmounts.set(item.questionId, item);
    for (const item of batch.secondaryFilterUpdates) secondaryFilters.set(item.questionId, item);
    for (const id of batch.questionsToRecalculate) questionsToRecalculate.add(id);
    sourceEffects.push(...batch.sourceEffects);
  }

  return Object.freeze({
    changedVariableIds: Object.freeze([...changedVariableIds]),
    answerCommands: Object.freeze(answerCommands),
    paymentAmountOverrides: Object.freeze([...paymentAmounts.values()]),
    secondaryFilterUpdates: Object.freeze([...secondaryFilters.values()]),
    questionsToRecalculate: Object.freeze([...questionsToRecalculate]),
    sourceEffects: Object.freeze(sourceEffects),
  });
}
