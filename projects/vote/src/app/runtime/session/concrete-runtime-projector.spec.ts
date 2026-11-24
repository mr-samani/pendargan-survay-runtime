import { describe, expect, it } from 'vitest';
import { ExpressionActionsEnum, ExpressionTargetsEnum, FormExpressionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyDependencyGraph } from '../definition/dependency-graph';
import type { SurveyExpressionCompilation } from '../definition/expression.compiler';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import { ConcreteSurveyRuntimeProjector } from './concrete-runtime-projector';

const definition: SurveyDefinition = {
  id: 'survey',
  sections: [{ id: 'section', uniqueIdPerForm: 'section-fid', source: {} }],
  questions: [{
    id: 'question', sourceId: 'question-source', uniqueIdPerForm: 'question-fid',
    formSectionUniqueId: 'section-fid', isActive: true, isRequired: false,
    options: [{ id: 'option', sourceId: 'option-source', uniqueIdPerForm: 'option-fid', source: {}, settings: null }],
    source: {}, settings: null,
  }],
  expressions: [{
    id: 'select-expression', expressionText: 'true', isActive: true, source: {},
    formExpressionType: FormExpressionTypeEnum.InsideForm, targetType: ExpressionTargetsEnum.Answer,
    targetKey: 'option-fid', actionType: ExpressionActionsEnum.Select, formQuestionUniqueId: 'question-fid',
  }],
  globalVariables: [],
};
const graph: SurveyDependencyGraph = {
  surveyId: 'survey', nodes: [], edges: [], topologicalOrder: [], blockedNodeIds: [],
  cycleComponents: [], diagnostics: [], isValid: true,
};
const expressions: SurveyExpressionCompilation = {
  surveyId: 'survey',
  expressions: [{
    id: 'select-expression', formulaId: 'survey::expression::select-expression',
    expressionText: 'true', actionType: ExpressionActionsEnum.Select,
    targetType: ExpressionTargetsEnum.Answer, targetKey: 'option-fid',
    formQuestionUniqueId: 'question-fid', formExpressionType: FormExpressionTypeEnum.InsideForm,
    isActive: true, isCompiled: true, isVolatile: false, isValid: true, dependencies: [],
  }],
  globalVariables: [], diagnostics: [], isValid: true,
};
function makeEvaluation(selected: boolean, action = ExpressionActionsEnum.Select): SurveyFullEvaluationResult {
  return {
    surveyId: 'survey', formulaResults: [], globalVariableValues: [],
    proposedActions: selected && action === ExpressionActionsEnum.Select ? [] : [{
      expressionId: 'select-expression', formulaId: 'survey::expression::select-expression',
      actionType: action, targetType: ExpressionTargetsEnum.Answer, targetKey: 'option-fid',
      formQuestionUniqueId: 'question-fid', formExpressionType: FormExpressionTypeEnum.InsideForm,
      value: action === ExpressionActionsEnum.Select, conditionMet: true,
    }],
    diagnostics: [], isValid: true,
  };
}

describe('ConcreteSurveyRuntimeProjector', () => {
  it('re-evaluates after Select actions and returns the reconciled answer snapshot', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    let evaluations = 0;
    const projector = new ConcreteSurveyRuntimeProjector(graph, expressions, {
      evaluate: ({ answers: current }) => {
        evaluations++;
        return makeEvaluation(current.instances['root']['question'].selectedOptionIds.includes('option'));
      },
    });
    const result = projector.project(definition, answers, loops, 'root');
    expect(result.isStable).toBe(true);
    expect(result.answerState.revision).toBe(1);
    expect(result.answerState.instances['root']['question'].selectedOptionIds).toEqual(['option']);
    expect(evaluations).toBe(2);
    expect(result.validation.answerRevision).toBe(result.answerState.revision);
  });

  it('detects answer/action feedback cycles', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const projector = new ConcreteSurveyRuntimeProjector(graph, expressions, {
      evaluate: ({ answers: current }) => {
        const selected = current.instances['root']['question'].selectedOptionIds.includes('option');
        return makeEvaluation(selected, selected ? ExpressionActionsEnum.UnSelect : ExpressionActionsEnum.Select);
      },
    });
    const result = projector.project(definition, answers, loops, 'root');
    expect(result.isStable).toBe(false);
    expect(result.diagnostics[0].code).toBe('ACTION_RECALCULATION_CYCLE');
  });

  it('reconciles answer-changing actions before projecting visibility from the stable pass', () => {
    const hideExpression = {
      id: 'hide-option-expression', expressionText: 'true', isActive: true, source: {},
      formExpressionType: FormExpressionTypeEnum.InsideForm,
      targetType: ExpressionTargetsEnum.Answer, targetKey: 'option-fid',
      actionType: ExpressionActionsEnum.Hide, formQuestionUniqueId: 'question-fid',
    };
    const hideCompiled = {
      id: 'hide-option-expression', formulaId: 'survey::expression::hide-option-expression',
      expressionText: 'true', actionType: ExpressionActionsEnum.Hide,
      targetType: ExpressionTargetsEnum.Answer, targetKey: 'option-fid',
      formQuestionUniqueId: 'question-fid', formExpressionType: FormExpressionTypeEnum.InsideForm,
      isActive: true, isCompiled: true, isVolatile: false, isValid: true, dependencies: [],
    };
    const withHideDefinition: SurveyDefinition = {
      ...definition, expressions: [...definition.expressions, hideExpression],
    };
    const withHideCompilation: SurveyExpressionCompilation = {
      ...expressions, expressions: [...expressions.expressions, hideCompiled],
    };
    const answers = createInitialAnswerState(withHideDefinition);
    const loops = createSurveyLoopRuntime(withHideDefinition);
    let evaluations = 0;
    const projector = new ConcreteSurveyRuntimeProjector(graph, withHideCompilation, {
      evaluate: ({ answers: current }) => {
        evaluations++;
        const selected = current.instances['root']['question'].selectedOptionIds.includes('option');
        return {
          surveyId: 'survey', formulaResults: [], globalVariableValues: [],
          proposedActions: [
            ...(!selected ? [{
              expressionId: 'select-expression', formulaId: 'survey::expression::select-expression',
              actionType: ExpressionActionsEnum.Select, targetType: ExpressionTargetsEnum.Answer,
              targetKey: 'option-fid', formQuestionUniqueId: 'question-fid',
              formExpressionType: FormExpressionTypeEnum.InsideForm, value: true, conditionMet: true,
            }] : []),
            {
              expressionId: 'hide-option-expression', formulaId: 'survey::expression::hide-option-expression',
              actionType: ExpressionActionsEnum.Hide, targetType: ExpressionTargetsEnum.Answer,
              targetKey: 'option-fid', formQuestionUniqueId: 'question-fid',
              formExpressionType: FormExpressionTypeEnum.InsideForm, value: true, conditionMet: true,
            },
          ],
          diagnostics: [], isValid: true,
        };
      },
    });

    const result = projector.project(withHideDefinition, answers, loops, 'root');
    expect(result.isStable).toBe(true);
    expect(evaluations).toBe(2);
    expect(result.answerState.instances['root']['question'].selectedOptionIds).toEqual(['option']);
    expect(result.visibility.questions[0].options[0].isVisible).toBe(false);
    expect(result.visibility.questions[0].isVisible).toBe(false);
  });

});
