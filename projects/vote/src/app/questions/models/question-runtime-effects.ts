import type { LegacyGlobalVariableEffectBatch } from '../../runtime/session/legacy-global-variable-dispatcher';

export interface QuestionRuntimeEffectState {
  readonly paymentAmount?: number;
  readonly secondaryFieldValueFilter?: string;
  readonly fieldValueFilter?: string;
  readonly revision: number;
}

export type QuestionRuntimeEffectsByInstance = Readonly<
  Record<string, Readonly<Record<string, QuestionRuntimeEffectState>>>
>;

export interface QuestionRuntimeEffectApplication {
  readonly state: QuestionRuntimeEffectsByInstance;
  readonly changedQuestionIds: readonly string[];
  readonly paymentAmountQuestionIds: readonly string[];
  readonly secondaryFilterQuestionIds: readonly string[];
}

/**
 * Persists the UI-facing, non-answer effects emitted by the runtime projector.
 * State is partitioned by answer instance so repeated SectionLoop iterations
 * never share Payment or dynamic-filter overrides.
 */
export function applyQuestionRuntimeEffects(
  previous: QuestionRuntimeEffectsByInstance,
  instanceId: string,
  batch: LegacyGlobalVariableEffectBatch,
): QuestionRuntimeEffectApplication {
  const instance: Record<string, QuestionRuntimeEffectState> = {
    ...(previous[instanceId] ?? {}),
  };
  const changed = new Set<string>();
  const paymentChanged = new Set<string>();
  const filterChanged = new Set<string>();

  for (const item of batch.paymentAmountOverrides) {
    const current = instance[item.questionId];
    if (Object.is(current?.paymentAmount, item.amount)) continue;
    instance[item.questionId] = {
      ...current,
      paymentAmount: item.amount,
      revision: current?.revision ?? 0,
    };
    changed.add(item.questionId);
    paymentChanged.add(item.questionId);
  }

  for (const item of batch.secondaryFilterUpdates) {
    const current = instance[item.questionId];
    if (Object.is(current?.secondaryFieldValueFilter, item.value)) continue;
    instance[item.questionId] = {
      ...current,
      secondaryFieldValueFilter: item.value,
      revision: current?.revision ?? 0,
    };
    changed.add(item.questionId);
    filterChanged.add(item.questionId);
  }

  if (changed.size === 0) {
    return Object.freeze({
      state: previous,
      changedQuestionIds: Object.freeze([]),
      paymentAmountQuestionIds: Object.freeze([]),
      secondaryFilterQuestionIds: Object.freeze([]),
    });
  }

  for (const questionId of changed) {
    const current = instance[questionId];
    instance[questionId] = Object.freeze({
      ...current,
      revision: (previous[instanceId]?.[questionId]?.revision ?? 0) + 1,
    });
  }

  return Object.freeze({
    state: Object.freeze({
      ...previous,
      [instanceId]: Object.freeze(instance),
    }),
    changedQuestionIds: Object.freeze([...changed]),
    paymentAmountQuestionIds: Object.freeze([...paymentChanged]),
    secondaryFilterQuestionIds: Object.freeze([...filterChanged]),
  });
}


export interface QuestionRuntimeDynamicFilterUpdate {
  readonly questionId: string;
  readonly value: string;
}

export interface QuestionRuntimeDynamicFilterApplication {
  readonly state: QuestionRuntimeEffectsByInstance;
  readonly changedQuestionIds: readonly string[];
}

/**
 * Replaces the complete expression-filter projection for one answer instance.
 * Clearing old entries first prevents stale filters when an expression becomes
 * inactive or a loop iteration is reactivated with a different filter set.
 */
export function replaceQuestionRuntimeDynamicFilters(
  previous: QuestionRuntimeEffectsByInstance,
  instanceId: string,
  updates: readonly QuestionRuntimeDynamicFilterUpdate[],
): QuestionRuntimeDynamicFilterApplication {
  const instance: Record<string, QuestionRuntimeEffectState> = {
    ...(previous[instanceId] ?? {}),
  };
  const changed = new Set<string>();

  for (const [questionId, current] of Object.entries(instance)) {
    if (current.fieldValueFilter === undefined) continue;
    instance[questionId] = Object.freeze({
      ...current,
      fieldValueFilter: undefined,
    });
    changed.add(questionId);
  }

  for (const item of updates) {
    const current = instance[item.questionId];
    if (Object.is(current?.fieldValueFilter, item.value)) continue;
    instance[item.questionId] = Object.freeze({
      ...current,
      fieldValueFilter: item.value,
      revision: current?.revision ?? 0,
    });
    changed.add(item.questionId);
  }

  if (changed.size === 0) {
    return Object.freeze({ state: previous, changedQuestionIds: Object.freeze([]) });
  }

  for (const questionId of changed) {
    const current = instance[questionId];
    instance[questionId] = Object.freeze({
      ...current,
      revision: (previous[instanceId]?.[questionId]?.revision ?? 0) + 1,
    });
  }

  return Object.freeze({
    state: Object.freeze({
      ...previous,
      [instanceId]: Object.freeze(instance),
    }),
    changedQuestionIds: Object.freeze([...changed]),
  });
}

export function getQuestionRuntimeEffect(
  state: QuestionRuntimeEffectsByInstance,
  instanceId: string,
  questionId: string,
): QuestionRuntimeEffectState | undefined {
  return state[instanceId]?.[questionId];
}
