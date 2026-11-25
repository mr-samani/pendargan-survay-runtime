import { describe, expect, it } from 'vitest';
import { ExpressionTargetsEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyDependencyGraph } from '../definition/dependency-graph';
import type { SurveyExpressionCompilation } from '../definition/expression.compiler';
import { buildLegacyQuestionExecutionPlan, flattenLegacyQuestionExecutionPlan, selectLegacyExecutionItems } from './legacy-question-execution-plan';

const definition: SurveyDefinition = {
  id: 'survey',
  sections: [],
  questions: [
    { id: 'q1-fid', sourceId: 'q1', isActive: true, isRequired: false, source: {}, settings: null, options: [] },
    { id: 'q2-fid', sourceId: 'q2', isActive: true, isRequired: false, source: {}, settings: null, options: [] },
  ],
  expressions: [],
  globalVariables: [],
};

const compilation: SurveyExpressionCompilation = {
  surveyId: 'survey',
  diagnostics: [],
  isValid: true,
  globalVariables: [
    { id: 'gvar-2', title: 'second', expression: '2', formQuestionUniqueId: 'q1', type: undefined, isActive: true,
      isCompiled: true, isVolatile: false, isValid: true, dependencies: [] },
    { id: 'gvar-1', title: 'first', expression: '1', formQuestionUniqueId: 'q1-fid', type: undefined, isActive: true,
      isCompiled: true, isVolatile: false, isValid: true, dependencies: [] },
    { id: 'gvar-inactive', title: 'inactive', expression: '0', formQuestionUniqueId: 'q2', type: undefined, isActive: false,
      isCompiled: false, isVolatile: false, isValid: true, dependencies: [] },
  ],
  expressions: [
    { id: 'q1-expression', expressionText: 'true', formQuestionUniqueId: 'q1', actionType: undefined, formExpressionType: undefined, isActive: true,
      targetType: ExpressionTargetsEnum.Question, isCompiled: true, isVolatile: false, isValid: true,
      dependencies: [] },
    { id: 'section-expression', expressionText: 'true', actionType: undefined, formExpressionType: undefined, isActive: true,
      targetType: ExpressionTargetsEnum.Section, isCompiled: true, isVolatile: false, isValid: true,
      dependencies: [] },
    { id: 'loop-expression', expressionText: 'true', actionType: undefined, formExpressionType: undefined, isActive: true,
      targetType: ExpressionTargetsEnum.SectionLoop, isCompiled: true, isVolatile: false, isValid: true,
      dependencies: [] },
    { id: 'filter-expression', expressionText: 'category eq @Q1.Text', formQuestionUniqueId: 'q2',
      actionType: undefined, formExpressionType: undefined, isActive: true, targetType: ExpressionTargetsEnum.FilterDynamicAnswer,
      isCompiled: true, isVolatile: false, isValid: true, dependencies: ['@Q1.Text'] },
    { id: 'q2-expression', expressionText: 'true', formQuestionUniqueId: 'q2-fid', actionType: undefined, formExpressionType: undefined, isActive: true,
      targetType: ExpressionTargetsEnum.Answer, isCompiled: true, isVolatile: false, isValid: true,
      dependencies: [] },
  ],
};

describe('buildLegacyQuestionExecutionPlan', () => {
  it('preserves question order and source order of question-owned global variables', () => {
    const plan = buildLegacyQuestionExecutionPlan(definition, compilation);
    expect(plan.steps.map((step) => step.questionId)).toEqual(['q1-fid', 'q2-fid']);
    expect(plan.steps[0].globalVariableIds).toEqual(['gvar-2', 'gvar-1']);
    expect(plan.steps[0].expressionIds).toEqual(['q1-expression']);
    expect(plan.steps[1].expressionIds).toEqual(['q2-expression']);
  });

  it('revisits Section and SectionLoop expressions at every question step', () => {
    const plan = buildLegacyQuestionExecutionPlan(definition, compilation);
    for (const step of plan.steps) {
      expect(step.sectionExpressionIds).toEqual(['section-expression']);
      expect(step.sectionLoopExpressionIds).toEqual(['loop-expression']);
    }
  });

  it('classifies FilterDynamicAnswer separately from boolean action expressions', () => {
    const plan = buildLegacyQuestionExecutionPlan(definition, compilation);
    expect(plan.steps[1].dynamicFilterExpressionIds).toEqual(['filter-expression']);
    expect(plan.steps[1].expressionIds).not.toContain('filter-expression');
  });

  it('pulls future-owned formula dependencies forward while preserving topological order', () => {
    const withFormulaIds: SurveyExpressionCompilation = {
      ...compilation,
      globalVariables: compilation.globalVariables.map((item) => ({
        ...item,
        formulaId: item.id === 'gvar-2' ? 'gvar-2-formula' : 'gvar-1-formula',
      })),
      expressions: compilation.expressions.map((item) => ({
        ...item,
        formulaId: item.id + '-formula',
      })),
    };
    const graph: SurveyDependencyGraph = {
      surveyId: 'survey',
      nodes: [
        { id: 'formula:gvar-2-formula', kind: 'formula' },
        { id: 'global-variable:gvar-2', kind: 'global-variable' },
        { id: 'formula:gvar-1-formula', kind: 'formula' },
        { id: 'formula:q1-expression-formula', kind: 'formula' },
        { id: 'formula:section-expression-formula', kind: 'formula' },
        { id: 'formula:loop-expression-formula', kind: 'formula' },
        { id: 'formula:filter-expression-formula', kind: 'formula' },
        { id: 'formula:q2-expression-formula', kind: 'formula' },
      ],
      edges: [
        { from: 'formula:gvar-2-formula', to: 'global-variable:gvar-2', kind: 'produces' },
        { from: 'global-variable:gvar-2', to: 'formula:q1-expression-formula', kind: 'reads' },
      ],
      topologicalOrder: [
        'formula:gvar-2-formula',
        'global-variable:gvar-2',
        'formula:gvar-1-formula',
        'formula:q1-expression-formula',
        'formula:section-expression-formula',
        'formula:loop-expression-formula',
        'formula:filter-expression-formula',
        'formula:q2-expression-formula',
      ],
      blockedNodeIds: [],
      cycleComponents: [],
      diagnostics: [],
      isValid: true,
    };

    const plan = buildLegacyQuestionExecutionPlan(definition, withFormulaIds, graph);
    const firstStep = plan.steps[0];

    expect(firstStep.formulaIds).toEqual([
      'gvar-2-formula',
      'gvar-1-formula',
      'q1-expression-formula',
      'section-expression-formula',
      'loop-expression-formula',
    ]);
    expect(firstStep.evaluationNodeIds).toEqual([
      'formula:gvar-2-formula',
      'formula:gvar-1-formula',
      'formula:q1-expression-formula',
      'formula:section-expression-formula',
      'formula:loop-expression-formula',
    ]);
    expect(firstStep.evaluationNodeIds.indexOf('formula:gvar-2-formula'))
      .toBeLessThan(firstStep.evaluationNodeIds.indexOf('formula:q1-expression-formula'));
    expect(plan.steps[1].evaluationNodeIds).toContain('formula:filter-expression-formula');
  });

  it('flattens the complete question walk while retaining repeated section evaluations', () => {
    const withFormulaIds: SurveyExpressionCompilation = {
      ...compilation,
      globalVariables: compilation.globalVariables.map((item) => ({
        ...item, formulaId: item.id + '-formula',
      })),
      expressions: compilation.expressions.map((item) => ({
        ...item, formulaId: item.id + '-formula',
      })),
    };
    const plan = buildLegacyQuestionExecutionPlan(definition, withFormulaIds);
    const flattened = flattenLegacyQuestionExecutionPlan(plan);

    expect(flattened).toEqual([
      'formula:gvar-2-formula',
      'formula:gvar-1-formula',
      'formula:q1-expression-formula',
      'formula:section-expression-formula',
      'formula:loop-expression-formula',
      'formula:filter-expression-formula',
      'formula:q2-expression-formula',
      'formula:section-expression-formula',
      'formula:loop-expression-formula',
    ]);
  });

  it('reports global variables whose owner is missing from the question list', () => {
    const orphaned: SurveyExpressionCompilation = {
      ...compilation,
      globalVariables: [{
        id: 'orphan', title: 'orphan', expression: '1', formQuestionUniqueId: 'missing', type: undefined,
        isActive: true, isCompiled: true, isVolatile: false, isValid: true, dependencies: [],
      }],
    };
    expect(buildLegacyQuestionExecutionPlan(definition, orphaned).diagnostics[0].code)
      .toBe('LEGACY_GLOBAL_VARIABLE_OWNER_UNRESOLVED');
  });

  it('rejects a compilation for a different survey and preserves item order in selection', () => {
    expect(buildLegacyQuestionExecutionPlan(definition, { ...compilation, surveyId: 'other' }).diagnostics[0].code)
      .toBe('LEGACY_EXECUTION_PLAN_SURVEY_MISMATCH');
    expect(selectLegacyExecutionItems(compilation.globalVariables, ['gvar-1', 'gvar-2'])
      .map((item) => item.id)).toEqual(['gvar-2', 'gvar-1']);
  });
});
