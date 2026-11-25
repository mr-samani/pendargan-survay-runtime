import { FormulaEngineService } from 'ngx-exp-parser';
import type { FormulaValue } from 'ngx-exp-parser';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormGlobalVariableDto,
  GetFormQuestionQuestionOptionDto,
  GetQuestionOptionDto,
  FormQuestionTypesEnum,
} from '@service-proxies/models';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';
import { buildSurveyDependencyGraph } from './dependency-graph';
import { compileSurveyExpressions } from './expression.compiler';
import { evaluateSurveyFully } from './full-evaluator';

function createRuntime(
  evaluate: (expression: string, variables: Map<string, { value: FormulaValue }>) => FormulaValue,
) {
  const variables = new Map<string, { name: string; value: FormulaValue; formulaId?: string }>();
  const evaluateExpression = vi.fn((expression: string) => ({
    success: true,
    value: evaluate(expression, variables),
    executionTime: 0.25,
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
  return { engine, variables, evaluateExpression, setVariable, deleteVariable };
}

function createCompiledSurvey() {
  const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
    formGuid: 'evaluation-survey',
    formExpressions: [
      new GetFormExpressionDto({
        uniqueId: 'condition-expression',
        expressionText: 'condition-source',
        actionType: ExpressionActionsEnum.Show,
        targetType: ExpressionTargetsEnum.Question,
        targetKey: 'question-target',
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
      expression === 'variable-b-source'
        ? ['[%a%]']
        : expression === 'condition-source'
          ? ['[%b%]']
          : [],
    ),
  }));
  const registrar = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;
  const expressions = compileSurveyExpressions(definition, registrar);
  const graph = buildSurveyDependencyGraph(definition, expressions);
  return { definition, expressions, graph };
}

describe('evaluateSurveyFully', () => {
  it('evaluates global variables in dependency order and returns actions without applying them', () => {
    const { expressions, graph } = createCompiledSurvey();
    const runtime = createRuntime((expression, variables) => {
      if (expression === 'variable-a-source') return 10;
      if (expression === 'variable-b-source') return Number(variables.get('a')?.value) + 5;
      if (expression === 'condition-source') return variables.get('b')?.value === 15;
      return null;
    });
    runtime.variables.set('a', { name: 'a', value: 999 });
    runtime.variables.set('b', { name: 'b', value: 888 });
    const scope = { untouched: true };

    const result = evaluateSurveyFully(graph, expressions, runtime.engine, scope);

    expect(result.isValid).toBe(true);
    expect(result.globalVariableValues).toEqual([
      { id: 'a', value: 10 },
      { id: 'b', value: 15 },
    ]);
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]).toMatchObject({
      expressionId: 'condition-expression',
      actionType: ExpressionActionsEnum.Show,
      targetType: ExpressionTargetsEnum.Question,
      targetKey: 'question-target',
      value: true,
      conditionMet: true,
    });
    expect(runtime.evaluateExpression.mock.calls.map(([expression]) => expression)).toEqual([
      'variable-a-source',
      'variable-b-source',
      'condition-source',
    ]);
    expect(runtime.variables.get('a')?.value).toBe(999);
    expect(runtime.variables.get('b')?.value).toBe(888);
    expect(scope.untouched).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not coerce non-boolean action formula results to true', () => {
    const { expressions, graph } = createCompiledSurvey();
    const runtime = createRuntime((expression) => expression === 'condition-source' ? 1 : 10);

    const result = evaluateSurveyFully(graph, expressions, runtime.engine, {});

    expect(result.isValid).toBe(true);
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]).toMatchObject({ value: 1, conditionMet: false });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'FORMULA_ACTION_RESULT_NOT_BOOLEAN',
      severity: 'warning',
    }));
  });
  it('blocks formulas that depend on a failed global variable', () => {
    const { expressions, graph } = createCompiledSurvey();
    const runtime = createRuntime((expression) => {
      if (expression === 'variable-a-source') return null;
      return 1;
    });
    runtime.evaluateExpression.mockImplementation((expression: string) => ({
      success: expression !== 'variable-a-source',
      value: expression === 'variable-a-source' ? null : 1,
      error: expression === 'variable-a-source' ? 'bad formula' : undefined,
      executionTime: 1,
    }));

    const result = evaluateSurveyFully(graph, expressions, runtime.engine, {});

    expect(result.isValid).toBe(false);
    expect(runtime.evaluateExpression).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.map((item) => item.code)).toContain('FORMULA_EVALUATION_FAILED');
    expect(result.diagnostics.map((item) => item.code)).toContain('FORMULA_DEPENDENCY_UNAVAILABLE');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('evaluates legacy question references with the installed FormulaEngineService', () => {
    TestBed.configureTestingModule({});
    const engine = TestBed.inject(FormulaEngineService);
    const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'real-engine-survey',
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
          uniqueId: 'real-expression',
          expressionText: '@Qq1.Aa1 && [%threshold%] > 3',
          actionType: ExpressionActionsEnum.Show,
          targetType: ExpressionTargetsEnum.Question,
          formQuestionUniqueId: 'question-db-id',
          isActive: true,
        }),
      ],
      formGlobalVariables: [
        new GetFormGlobalVariableDto({
          uniqueIdPerForm: 'threshold',
          title: 'Threshold',
          expression: '5',
          isActive: true,
        }),
      ],
    }));
    const expressions = compileSurveyExpressions(definition, engine);
    const graph = buildSurveyDependencyGraph(definition, expressions);
    const scope = engine.createReactiveModel({
      '@Qq1': { Aa1: true },
    });

    const result = evaluateSurveyFully(graph, expressions, engine, scope);

    expect(result.isValid).toBe(true);
    expect(result.globalVariableValues).toEqual([{ id: 'threshold', value: 5 }]);
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0].conditionMet).toBe(true);
    expect(engine.variables().get('threshold')?.value).toBe(null);
  });

  it('does not evaluate any formula when the dependency graph contains a cycle', () => {
    const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'cycle',
      formGlobalVariables: [
        new GetFormGlobalVariableDto({
          uniqueIdPerForm: 'a',
          title: 'A',
          expression: 'a-source',
          isActive: true,
        }),
        new GetFormGlobalVariableDto({
          uniqueIdPerForm: 'b',
          title: 'B',
          expression: 'b-source',
          isActive: true,
        }),
      ],
    }));
    const registerFormula = vi.fn((id: string, expression: string) => ({
      id,
      expression,
      isValid: true,
      dependencies: new Set(expression === 'a-source' ? ['[%b%]'] : ['[%a%]']),
    }));
    const registrar = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;
    const expressions = compileSurveyExpressions(definition, registrar);
    const graph = buildSurveyDependencyGraph(definition, expressions);
    const runtime = createRuntime(() => 1);

    const result = evaluateSurveyFully(graph, expressions, runtime.engine, {});

    expect(result.isValid).toBe(false);
    expect(runtime.evaluateExpression).not.toHaveBeenCalled();
  });
});
