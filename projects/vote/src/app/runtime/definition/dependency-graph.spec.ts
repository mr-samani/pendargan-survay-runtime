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
import type { FormulaEngineService } from 'ngx-exp-parser';
import { describe, expect, it, vi } from 'vitest';
import { compileSurveyDefinition } from './definition.compiler';
import { compileSurveyExpressions } from './expression.compiler';
import { buildSurveyDependencyGraph } from './dependency-graph';

function compileGraph(
  response: GetAllFormDetailForViewOutputDto,
  dependencies: Readonly<Record<string, readonly string[]>>,
) {
  const definition = compileSurveyDefinition(response);
  const registerFormula = vi.fn((id: string, expression: string) => ({
    id,
    expression,
    isValid: true,
    isVolatile: expression.includes('NOW'),
    dependencies: new Set(dependencies[expression] ?? []),
  }));
  const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;
  const expressions = compileSurveyExpressions(definition, engine);
  return {
    definition,
    expressions,
    graph: buildSurveyDependencyGraph(definition, expressions),
  };
}

describe('buildSurveyDependencyGraph', () => {
  it('connects legacy question/option inputs and global variables to formula and action nodes', () => {
    const { graph } = compileGraph(
      new GetAllFormDetailForViewOutputDto({
        formGuid: 'survey-a',
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
            uniqueId: 'show-expression',
            expressionText: 'show-expression-source',
            actionType: ExpressionActionsEnum.Show,
            targetType: ExpressionTargetsEnum.Question,
            formQuestionUniqueId: 'question-db-id',
            isActive: true,
          }),
        ],
        formGlobalVariables: [
          new GetFormGlobalVariableDto({
            uniqueId: 'variable-db-id',
            uniqueIdPerForm: 'variable-1',
            title: 'Total',
            expression: 'total-source',
            isActive: true,
          }),
        ],
      }),
      {
        'show-expression-source': [
          '@Qq1.Aa1',
          '[%variable-1%]',
          'customer.address.city',
          'rows[*]',
          'fn:NOW',
        ],
        'total-source': ['price', 'quantity'],
      },
    );

    const nodeIds = graph.nodes.map((node) => node.id);
    const edgeKeys = graph.edges.map((edge) => edge.from + '->' + edge.to);

    expect(graph.isValid).toBe(true);
    expect(nodeIds).toContain('option:option-db-id');
    expect(nodeIds).toContain('global-variable:variable-1');
    expect(nodeIds).toContain('scope:customer.address.city');
    expect(nodeIds).toContain('scope:rows[*]');
    expect(nodeIds).toContain('formula:survey-a::expression::show-expression');
    expect(nodeIds).toContain('action:show-expression');
    expect(edgeKeys).toContain(
      'option:option-db-id->formula:survey-a::expression::show-expression',
    );
    expect(edgeKeys).toContain(
      'global-variable:variable-1->formula:survey-a::expression::show-expression',
    );
    expect(edgeKeys).toContain(
      'formula:survey-a::expression::show-expression->action:show-expression',
    );
    expect(graph.diagnostics).toHaveLength(0);
    expect(Object.isFrozen(graph)).toBe(true);
  });

  it('detects global-variable cycles without recursive traversal', () => {
    const { graph } = compileGraph(
      new GetAllFormDetailForViewOutputDto({
        formGuid: 'cycle-survey',
        formGlobalVariables: [
          new GetFormGlobalVariableDto({
            uniqueIdPerForm: 'a',
            title: 'A',
            expression: 'formula-a',
            isActive: true,
          }),
          new GetFormGlobalVariableDto({
            uniqueIdPerForm: 'b',
            title: 'B',
            expression: 'formula-b',
            isActive: true,
          }),
        ],
      }),
      {
        'formula-a': ['[%b%]'],
        'formula-b': ['[%a%]'],
      },
    );

    expect(graph.isValid).toBe(false);
    expect(graph.cycleComponents).toHaveLength(1);
    expect(graph.cycleComponents[0]).toContain('global-variable:a');
    expect(graph.cycleComponents[0]).toContain('global-variable:b');
    expect(graph.diagnostics.map((item) => item.code)).toContain('DEPENDENCY_CYCLE');
    expect(graph.blockedNodeIds.length).toBeGreaterThanOrEqual(4);
  });

  it('retains unresolved external references as warnings rather than dropping dependencies', () => {
    const { graph } = compileGraph(
      new GetAllFormDetailForViewOutputDto({
        formGuid: 'external-survey',
        formExpressions: [
          new GetFormExpressionDto({
            uniqueId: 'expression',
            expressionText: 'external-source',
            isActive: true,
          }),
        ],
      }),
      {
        'external-source': ['[%missing-variable%]', '@Qmissing.Amissing'],
      },
    );

    expect(graph.isValid).toBe(true);
    expect(graph.nodes.some((node) => node.id === 'external:variable:[%missing-variable%]')).toBe(true);
    expect(graph.nodes.some((node) => node.id === 'external:entity:@Qmissing.Amissing')).toBe(true);
    expect(graph.diagnostics.map((item) => item.code)).toContain(
      'GLOBAL_VARIABLE_REFERENCE_UNRESOLVED',
    );
    expect(graph.diagnostics.map((item) => item.code)).toContain(
      'ENTITY_QUESTION_UNRESOLVED',
    );
  });

  it('handles long dependency chains with iterative traversal', () => {
    const count = 1200;
    const variables = Array.from({ length: count }, (_, index) =>
      new GetFormGlobalVariableDto({
        uniqueIdPerForm: 'v' + index,
        title: 'Variable ' + index,
        expression: 'expression-' + index,
        isActive: true,
      }),
    );
    const dependencies: Record<string, readonly string[]> = {};
    for (let index = 0; index < count - 1; index++) {
      dependencies['expression-' + index] = ['[%v' + (index + 1) + '%]'];
    }
    dependencies['expression-' + (count - 1)] = [];

    const { graph } = compileGraph(
      new GetAllFormDetailForViewOutputDto({
        formGuid: 'long-chain',
        formGlobalVariables: variables,
      }),
      dependencies,
    );

    expect(graph.isValid).toBe(true);
    expect(graph.cycleComponents).toHaveLength(0);
    expect(graph.topologicalOrder).toHaveLength(count * 2);
  });

  it('returns no graph for structurally invalid definitions', () => {
    const definition = compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
      formGuid: 'invalid',
      formQuestions: [
        new GetFormQuestionQuestionOptionDto({
          uniqueIdPerForm: 'q1',
        }),
      ],
    }));
    const registerFormula = vi.fn();
    const engine = { registerFormula } as unknown as Pick<FormulaEngineService, 'registerFormula'>;
    const expressions = compileSurveyExpressions(definition, engine);
    const graph = buildSurveyDependencyGraph(definition, expressions);

    expect(graph.isValid).toBe(false);
    expect(graph.nodes).toHaveLength(0);
    expect(registerFormula).not.toHaveBeenCalled();
  });
});
