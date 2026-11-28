import { describe, expect, it, vi } from 'vitest';
import {
  appendLegacyQueryParameterValues,
  evaluateLegacyGlobalVariablesForQuestion,
  toLegacyGlobalVariableExpressionValues,
  type LegacyGlobalVariablePlan,
} from './legacy-global-variable-runtime';

function plan(
  id: string,
  title: string,
  expression: string,
  variables: readonly string[],
  previousResult?: unknown,
  owner = 'question-db-1',
): LegacyGlobalVariablePlan {
  return {
    id, title, expression, variables, previousResult,
    formQuestionUniqueId: owner,
    isActive: true,
  };
}

describe('evaluateLegacyGlobalVariablesForQuestion', () => {
  it('evaluates only variables owned by the current question and preserves source order', () => {
    const evaluate = vi.fn((expression: string) => {
      if (expression.trim() === '10') return 10;
      if (expression.includes('"10" + 5')) return 15;
      return false;
    });
    const result = evaluateLegacyGlobalVariablesForQuestion(
      'question-db-1',
      [
        plan('first-id', 'First', '10', [], undefined),
        plan('other-id', 'Other', '99', [], undefined, 'another-question'),
        plan('second-id', 'Second', ' [%First%] + 5 ', ['[%First%]'], 0),
      ],
      {},
      evaluate,
    );

    expect(evaluate.mock.calls.map(([expression]) => expression.trim())).toEqual([
      '10',
      '"10" + 5',
    ]);
    expect(result.evaluated).toEqual([
      { id: 'first-id', title: 'First', result: 10, changed: true },
      { id: 'second-id', title: 'Second', result: 15, changed: true },
    ]);
    expect(result.answerStates['[%First%]']).toBe('"10"');
    expect(result.answerStates['[%Second%]']).toBe('"15"');
    expect(result.diagnostics).toEqual([]);
  });

  it('publishes string results as quoted values and exposes expression replacement values separately', () => {
    const result = evaluateLegacyGlobalVariablesForQuestion(
      'question-db-1',
      [plan('name-id', 'Name', '"Sam"', [], undefined)],
      {},
      (expression) => expression.includes('Sam') ? 'Samani' : '',
    );
    expect(result.answerStates['[%Name%]']).toBe('"Samani"');
    expect(toLegacyGlobalVariableExpressionValues(result.evaluated)).toEqual([
      { title: 'Name', result: 'Samani' },
    ]);
  });

  it('replaces missing dependencies with null and reports evaluation failures without publishing stale results', () => {
    const evaluate = vi.fn(() => { throw new Error('parser rejected formula'); });
    const result = evaluateLegacyGlobalVariablesForQuestion(
      'question-db-1',
      [plan('broken-id', 'Broken', ' @missing > 0 ', ['missing'], false)],
      { missing: null, '[%Broken%]': '"previous"' },
      evaluate,
    );

    expect(evaluate).toHaveBeenCalledWith(' null > 0 ');
    expect(result.evaluated).toEqual([
      { id: 'broken-id', title: 'Broken', result: false, changed: false },
    ]);
    expect(result.answerStates['[%Broken%]']).toBe('"previous"');
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'LEGACY_GLOBAL_VARIABLE_EVALUATION_FAILED',
    ]);
  });

  it('does not mutate the incoming answer-state object', () => {
    const source = Object.freeze({ base: 4 });
    const result = evaluateLegacyGlobalVariablesForQuestion(
      'question-db-1',
      [plan('sum-id', 'Sum', ' @base + 1 ', ['base'])],
      source,
      () => 5,
    );
    expect(source).toEqual({ base: 4 });
    expect(result.answerStates['[%Sum%]']).toBe('"5"');
    expect(Object.isFrozen(result.answerStates)).toBe(true);
  });

  it('skips inactive and non-owned variables', () => {
    const evaluate = vi.fn(() => 1);
    const result = evaluateLegacyGlobalVariablesForQuestion(
      'question-db-1',
      [
        { ...plan('inactive', 'Inactive', '1', []), isActive: false },
        plan('other-owner', 'Other', '2', [], undefined, 'question-db-2'),
      ],
      {},
      evaluate,
    );
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.evaluated).toEqual([]);
  });
});
  it('keeps configured global variables ahead of query parameters with the same normalized title', () => {
    const result = appendLegacyQueryParameterValues(
      [{ title: 'TENANT', result: 42 }],
      { tenant: 'query-value', campaign: 'spring' },
      (value) => value.trim().toUpperCase(),
    );
    expect(result).toEqual([
      { title: 'TENANT', result: 42 },
      { title: 'CAMPAIGN', result: 'SPRING' },
    ]);
  });

