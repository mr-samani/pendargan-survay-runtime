import type { FormulaEngineService, FormulaValue } from 'ngx-exp-parser';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormQuestionTypesEnum,
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormGlobalVariableDto,
  GetFormQuestionQuestionOptionDto,
  GetQuestionOptionDto,
} from '@service-proxies/models';
import { describe, expect, it, vi } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';
import { buildSurveyDependencyGraph } from './dependency-graph';
import { compileSurveyExpressions } from './expression.compiler';
import { evaluateSurveyFully } from './full-evaluator';
import { SurveyIncrementalEvaluator } from './incremental-evaluator';

function createScenario(
  evaluate: (expression: string, variables: Map<string, { value: FormulaValue }>, scope: object) => FormulaValue,
) {
  const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
    formGuid: 'incremental-survey',
    formQuestions: [
      new GetFormQuestionQuestionOptionDto({
        uniqueId: 'question-db-id',
        uniqueIdPerForm: 'q-1',
        questionType: FormQuestionTypesEnum.UniqueSelect,
        isActive: true,
        questionOptions: [
          new GetQuestionOptionDto({
            uniqueId: 'option-db-id',
            uniqueIdPerForm: 'a-1',
          }),
        ],
      }),
    ],
    formExpressions: [
      new GetFormExpressionDto({
        uniqueId: 'condition',
        expressionText: 'condition-source',
        actionType: ExpressionActionsEnum.Show,
        targetType: ExpressionTargetsEnum.Question,
        isActive: true,
      }),
    ],
    formGlobalVariables: [
      new GetFormGlobalVariableDto({
        uniqueIdPerForm: 'a',
        title: 'A',
        expression: 'variable-a-source',
        isActive: true,
      }),
      new GetFormGlobalVariableDto({
        uniqueIdPerForm: 'b',
        title: 'B',
        expression: 'variable-b-source',
        isActive: true,
      }),
    ],
  }));

  const registerFormula = vi.fn((id: string, expression: string) => ({
    id,
    expression,
    isValid: true,
    dependencies: new Set(
      expression === 'variable-a-source'
        ? ['@Qq1.Aa1']
        : expression === 'variable-b-source'
          ? ['[%a%]']
          : ['[%b%]'],
    ),
  }));
  const registrar = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;
  const expressions = compileSurveyExpressions(definition, registrar);
  const graph = buildSurveyDependencyGraph(definition, expressions);

  const variables = new Map<string, { name: string; value: FormulaValue; formulaId?: string }>();
  const evaluateExpression = vi.fn((expression: string, scope: object) => ({
    success: true,
    value: evaluate(expression, variables, scope),
    executionTime: 0.1,
  }));
  const setVariable = vi.fn((name: string, value: FormulaValue) => {
    variables.set(name, { name, value, formulaId: variables.get(name)?.formulaId });
  });
  const deleteVariable = vi.fn((name: string) => variables.delete(name));
  const engine = {
    evaluateExpression,
    setVariable,
    deleteVariable,
    variables: () => variables,
  } as unknown as Pick<
    FormulaEngineService,
    'evaluateExpression' | 'setVariable' | 'deleteVariable' | 'variables'
  >;

  return { definition, expressions, graph, engine, variables, evaluateExpression };
}

function selected(scope: object): boolean {
  return Boolean((scope as { '@Qq1': { Aa1: boolean } })['@Qq1'].Aa1);
}

describe('SurveyIncrementalEvaluator', () => {
  it('recomputes only reachable formulas and matches the full evaluator', () => {
    const scenario = createScenario((expression, variables, scope) => {
      if (expression === 'variable-a-source') return selected(scope) ? 10 : 20;
      if (expression === 'variable-b-source') return Number(variables.get('a')?.value) + 5;
      if (expression === 'condition-source') return Number(variables.get('b')?.value) > 15;
      return null;
    });
    const initialScope = { '@Qq1': { Aa1: true } };
    const changedScope = { '@Qq1': { Aa1: false } };
    const incremental = new SurveyIncrementalEvaluator();

    const initial = incremental.initialize(
      scenario.graph,
      scenario.expressions,
      scenario.engine,
      initialScope,
    );
    expect(initial.globalVariableValues).toEqual([
      { id: 'a', value: 10 },
      { id: 'b', value: 15 },
    ]);

    scenario.evaluateExpression.mockClear();
    const updated = incremental.update(['option:a-1'], changedScope);

    const fullScenario = createScenario((expression, variables, scope) => {
      if (expression === 'variable-a-source') return selected(scope) ? 10 : 20;
      if (expression === 'variable-b-source') return Number(variables.get('a')?.value) + 5;
      if (expression === 'condition-source') return Number(variables.get('b')?.value) > 15;
      return null;
    });
    const full = evaluateSurveyFully(
      fullScenario.graph,
      fullScenario.expressions,
      fullScenario.engine,
      changedScope,
    );

    expect(updated.globalVariableValues).toEqual(full.globalVariableValues);
    expect(updated.proposedActions).toEqual(full.proposedActions);
    expect(updated.formulaResults.map((item) => item.value)).toEqual(
      full.formulaResults.map((item) => item.value),
    );
    expect(updated.proposedActions[0].conditionMet).toBe(true);
    expect(scenario.evaluateExpression).toHaveBeenCalledTimes(3);
  });

  it('stops propagation when a recomputed global variable is unchanged', () => {
    const scenario = createScenario((expression, variables) => {
      if (expression === 'variable-a-source') return 10;
      if (expression === 'variable-b-source') return Number(variables.get('a')?.value) + 5;
      if (expression === 'condition-source') return Number(variables.get('b')?.value) > 10;
      return null;
    });
    const incremental = new SurveyIncrementalEvaluator();
    const initialScope = { '@Qq1': { Aa1: true } };

    incremental.initialize(
      scenario.graph,
      scenario.expressions,
      scenario.engine,
      initialScope,
    );
    scenario.evaluateExpression.mockClear();

    const updated = incremental.update(
      ['option:a-1'],
      { '@Qq1': { Aa1: false } },
    );

    expect(scenario.evaluateExpression).toHaveBeenCalledTimes(1);
    expect(updated.globalVariableValues).toEqual([
      { id: 'a', value: 10 },
      { id: 'b', value: 15 },
    ]);
    expect(updated.proposedActions[0].conditionMet).toBe(true);
  });

  it('reports unknown changed node IDs without discarding the last snapshot', () => {
    const scenario = createScenario(() => 1);
    const incremental = new SurveyIncrementalEvaluator();
    incremental.initialize(
      scenario.graph,
      scenario.expressions,
      scenario.engine,
      { '@Qq1': { Aa1: true } },
    );

    const result = incremental.update(['option:missing'], { '@Qq1': { Aa1: true } });

    expect(result.isValid).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toContain('INCREMENTAL_INPUT_UNKNOWN');
    expect(result.proposedActions).toHaveLength(1);
  });

  it('requires initialization before updates', () => {
    const incremental = new SurveyIncrementalEvaluator();
    expect(() => incremental.update(['option:a-1'])).toThrow(
      'SurveyIncrementalEvaluator must be initialized before update().',
    );
  });
});
