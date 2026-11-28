import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition, SurveyQuestionDefinition } from '../definition/definition.types';
import type { ProposedSurveyAction } from '../definition/full-evaluator';
import { describe, expect, it } from 'vitest';
import { resolveSurveyActions } from './action-transaction';

const QUESTION_COUNT = 2_000;
const OPTIONS_PER_QUESTION = 4;
const ACTION_COUNT = 1_500;
const WARMUP_ITERATIONS = 3;
const MEASURED_ITERATIONS = 15;

function createFixture(): { definition: SurveyDefinition; actions: ProposedSurveyAction[] } {
  const questions: SurveyQuestionDefinition[] = Array.from({ length: QUESTION_COUNT }, (_, questionIndex) => ({
    id: 'question-' + questionIndex,
    sourceId: 'question-source-' + questionIndex,
    uniqueIdPerForm: 'question-fid-' + questionIndex,
    source: {},
    isActive: true,
    isRequired: false,
    settings: null,
    options: Array.from({ length: OPTIONS_PER_QUESTION }, (_, optionIndex) => ({
      id: 'option-' + questionIndex + '-' + optionIndex,
      sourceId: 'option-source-' + questionIndex + '-' + optionIndex,
      uniqueIdPerForm: 'option-fid-' + questionIndex + '-' + optionIndex,
      source: {},
      settings: null,
    })),
  }));
  const definition: SurveyDefinition = {
    id: 'action-resolution-benchmark',
    sections: [],
    questions,
    expressions: [],
    globalVariables: [],
  };

  // 997 is coprime with 2,000, so each action addresses a distinct question.
  const actions: ProposedSurveyAction[] = Array.from({ length: ACTION_COUNT }, (_, index) => {
    const questionIndex = (index * 997) % QUESTION_COUNT;
    const optionIndex = index % OPTIONS_PER_QUESTION;
    return {
      expressionId: 'expression-' + index,
      formulaId: 'formula-' + index,
      actionType: ExpressionActionsEnum.Select,
      targetType: ExpressionTargetsEnum.Answer,
      targetKey: 'option-source-' + questionIndex + '-' + optionIndex,
      formQuestionUniqueId: 'question-source-' + questionIndex,
      formExpressionType: FormExpressionTypeEnum.InsideForm,
      value: true,
      conditionMet: true,
    };
  });

  return { definition, actions };
}

/** Reference implementation of the pre-indexed lookup path for unique valid targets. */
function resolveNaively(
  definition: SurveyDefinition,
  actions: readonly ProposedSurveyAction[],
): readonly { questionId: string; optionId: string }[] {
  const commands: { questionId: string; optionId: string }[] = [];
  for (const action of actions) {
    const question = definition.questions.find((item) =>
      item.sourceId === action.formQuestionUniqueId ||
      item.uniqueIdPerForm === action.formQuestionUniqueId ||
      item.id === action.formQuestionUniqueId);
    if (!question || typeof action.targetKey !== 'string') continue;
    const option = question.options.find((item) =>
      item.uniqueIdPerForm === action.targetKey ||
      item.sourceId === action.targetKey ||
      item.id === action.targetKey);
    if (option) commands.push({ questionId: question.id, optionId: option.id });
  }
  return commands;
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function measure(run: () => void): { p50: number; p95: number; p99: number; mean: number } {
  for (let index = 0; index < WARMUP_ITERATIONS; index++) run();
  const samples: number[] = [];
  for (let index = 0; index < MEASURED_ITERATIONS; index++) {
    const startedAt = performance.now();
    run();
    samples.push(performance.now() - startedAt);
  }
  return {
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    mean: samples.reduce((total, value) => total + value, 0) / samples.length,
  };
}

describe('action resolution microbenchmark', () => {
  it('compares indexed lookup with the previous linear lookup on a large synthetic survey', () => {
    const { definition, actions } = createFixture();
    const expected = resolveNaively(definition, actions);
    const actual = resolveSurveyActions(definition, 'root', actions);
    expect(actual.isValid).toBe(true);
    expect(actual.commands).toHaveLength(ACTION_COUNT);
    expect(actual.commands.map(({ questionId, optionId }) => ({ questionId, optionId }))).toEqual(expected);

    // Measure the one-time index construction separately from warm transactions.
    const coldFixture = createFixture();
    const coldStartedAt = performance.now();
    const coldResult = resolveSurveyActions(coldFixture.definition, 'root', coldFixture.actions);
    const coldIndexAndResolveMs = performance.now() - coldStartedAt;
    expect(coldResult.commands).toHaveLength(ACTION_COUNT);

    const linear = measure(() => { resolveNaively(definition, actions); });
    const indexed = measure(() => { resolveSurveyActions(definition, 'root', actions); });
    const runtime = globalThis as unknown as { process?: { version?: string } };

    console.info('[runtime-benchmark:action-resolution]', JSON.stringify({
      node: runtime.process?.version ?? 'unknown',
      fixture: {
        questions: QUESTION_COUNT,
        optionsPerQuestion: OPTIONS_PER_QUESTION,
        totalOptions: QUESTION_COUNT * OPTIONS_PER_QUESTION,
        actions: ACTION_COUNT,
        warmupIterations: WARMUP_ITERATIONS,
        measuredIterations: MEASURED_ITERATIONS,
      },
      coldIndexAndResolveMs,
      linear,
      indexed,
      measuredSpeedupMedian: linear.p50 / Math.max(indexed.p50, 0.000001),
      note: 'Synthetic microbenchmark only; not a full survey runtime or browser benchmark.',
    }));
  });
});
