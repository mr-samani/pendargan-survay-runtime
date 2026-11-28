import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { CompiledExpression, SurveyExpressionCompilation } from '../definition/expression.compiler';
import type {
  FormulaExecutionResult,
  ProposedSurveyAction,
  SurveyFullEvaluationResult,
} from '../definition/full-evaluator';
import { describe, expect, it } from 'vitest';
import { resolveSurveyVisibility } from './visibility-engine';

function definition(): SurveyDefinition {
  return {
    id: 'survey',
    sections: [{ id: 'section-1', source: {}, sourceId: 'section-db-1', uniqueIdPerForm: 'section-form-1' }],
    questions: [
      {
        id: 'question-1', source: {}, sourceId: 'question-db-1', uniqueIdPerForm: 'question-form-1',
        formSectionUniqueId: 'section-form-1', isActive: true, isRequired: false, options: [
          { id: 'option-1', source: {}, sourceId: 'option-db-1', uniqueIdPerForm: 'option-1', settings: null },
          { id: 'option-2', source: {}, sourceId: 'option-db-2', uniqueIdPerForm: 'option-2', settings: null },
        ], settings: null,
      },
      {
        id: 'question-2', source: {}, sourceId: 'question-db-2', uniqueIdPerForm: 'question-form-2',
        formSectionUniqueId: 'section-form-1', isActive: true, isRequired: false, options: [], settings: null,
      },
    ],
    expressions: [], globalVariables: [],
  };
}
function expression(
  id: string, actionType: ExpressionActionsEnum, targetType: ExpressionTargetsEnum,
  targetKey?: string, questionId = 'question-db-1',
): CompiledExpression {
  return {
    id, formulaId: 'survey::expression::' + id, expressionText: 'formula-' + id,
    actionType, targetType, targetKey, formQuestionUniqueId: questionId,
    formExpressionType: FormExpressionTypeEnum.InsideForm,
    isActive: true, isCompiled: true, isVolatile: false, isValid: true, dependencies: [],
  };
}
function action(e: CompiledExpression, conditionMet: boolean): ProposedSurveyAction {
  return {
    expressionId: e.id, formulaId: e.formulaId!, actionType: e.actionType,
    targetType: e.targetType, targetKey: e.targetKey,
    formQuestionUniqueId: e.formQuestionUniqueId,
    formExpressionType: e.formExpressionType, value: conditionMet, conditionMet,
  };
}
function inputs(
  expressions: CompiledExpression[], actions: ProposedSurveyAction[], failed: string[] = [],
): { compilation: SurveyExpressionCompilation; evaluation: SurveyFullEvaluationResult } {
  const formulaResults: FormulaExecutionResult[] = expressions.map((e) => ({
    formulaId: e.formulaId!, kind: 'expression', sourceId: e.id,
    success: !failed.includes(e.formulaId!), value: true,
    error: failed.includes(e.formulaId!) ? 'evaluation error' : undefined, executionTime: 0,
  }));
  return {
    compilation: { surveyId: 'survey', expressions, globalVariables: [], diagnostics: [], isValid: true },
    evaluation: {
      surveyId: 'survey', formulaResults, globalVariableValues: [], proposedActions: actions,
      diagnostics: [], isValid: true,
    },
  };
}

describe('resolveSurveyVisibility', () => {
  it('defaults active questions, options and sections to visible', () => {
    const def = definition(); const data = inputs([], []);
    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);
    expect(result.questions.map((item) => item.isVisible)).toEqual([true, true]);
    expect(result.questions[0].options.map((item) => item.isVisible)).toEqual([true, true]);
    expect(result.sections[0].isVisible).toBe(true);
  });

  it('hides a question when all its options are hidden and hides a section when all questions are hidden', () => {
    const def = definition();
    const a = expression('hide-1', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Answer, 'option-1');
    const b = expression('hide-2', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Answer, 'option-2');
    const c = expression('hide-question', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Question, undefined, 'question-db-2');
    const data = inputs([a, b, c], [action(a, true), action(b, true), action(c, true)]);
    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);
    expect(result.questions.map((item) => item.isVisible)).toEqual([false, false]);
    expect(result.sections[0].isVisible).toBe(false);
  });

  it('uses AND for repeated Show/Hide conditions and Hide wins', () => {
    const def = definition();
    const a = expression('show-true', ExpressionActionsEnum.Show, ExpressionTargetsEnum.Question);
    const b = expression('show-false', ExpressionActionsEnum.Show, ExpressionTargetsEnum.Question);
    const c = expression('hide-false', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Question);
    const data = inputs([a, b, c], [action(a, true), action(b, false), action(c, false)]);
    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);
    expect(result.questions[0].isVisible).toBe(false);
  });

  it('keeps visibility unknown when an active condition failed and no other condition decides it', () => {
    const def = definition();
    const e = expression('failed-show', ExpressionActionsEnum.Show, ExpressionTargetsEnum.Question);
    const data = inputs([e], [], [e.formulaId!]);
    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);
    expect(result.questions[0].isVisible).toBe(null);
    expect(result.diagnostics.map((item) => item.code)).toContain('VISIBILITY_CONDITION_UNAVAILABLE');
    expect(result.isValid).toBe(false);
  });

  it('preserves non-visibility actions for later handlers', () => {
    const def = definition();
    const e = expression('select', ExpressionActionsEnum.Select, ExpressionTargetsEnum.Answer, 'option-1');
    const data = inputs([e], [action(e, true)]);
    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);
    expect(result.unhandledActions).toEqual([action(e, true)]);
  });

  it('supports an explicit policy for empty sections', () => {
    const def = definition();
    const data = inputs([], []);
    const empty = { ...def, sections: [{ id: 'empty', source: {}, sourceId: 'empty-db' }] };
    const result = resolveSurveyVisibility(empty, data.compilation, data.evaluation, { emptySectionVisibility: 'hidden' });
    expect(result.sections[0].isVisible).toBe(false);
  });
  it('preserves first-match question resolution when aliases collide', () => {
    const base = definition();
    const first = base.questions[0];
    const duplicate = {
      ...first,
      id: 'question-duplicate',
      uniqueIdPerForm: 'question-form-duplicate',
      options: [],
    };
    const def: SurveyDefinition = { ...base, questions: [first, duplicate, base.questions[1]] };
    const hide = expression('hide-first-question', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Question);
    const data = inputs([hide], [action(hide, true)]);

    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);

    expect(result.questions.map((item) => item.isVisible)).toEqual([false, true, true]);
  });

  it('preserves first-match option resolution when visibility aliases collide', () => {
    const base = definition();
    const question = {
      ...base.questions[0],
      options: [
        { id: 'first-option', source: {}, uniqueIdPerForm: 'shared-option', settings: null },
        { id: 'second-option', source: {}, uniqueIdPerForm: 'shared-option', settings: null },
      ],
    };
    const def: SurveyDefinition = { ...base, questions: [question, base.questions[1]] };
    const hide = expression('hide-shared-option', ExpressionActionsEnum.Hide, ExpressionTargetsEnum.Answer, 'shared-option');
    const data = inputs([hide], [action(hide, true)]);

    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);

    expect(result.questions[0].options.map((item) => [item.optionId, item.isVisible])).toEqual([
      ['first-option', false],
      ['second-option', true],
    ]);
    expect(result.questions[0].isVisible).toBe(true);
  });

  it('indexes section membership without duplicating questions across repeated aliases', () => {
    const base = definition();
    const sections = [
      { id: 'section-a', source: {}, sourceId: 'shared-section', uniqueIdPerForm: 'shared-section' },
      { id: 'section-b', source: {}, sourceId: 'shared-section', uniqueIdPerForm: 'other-section' },
    ];
    const questions = base.questions.map((question) => ({
      ...question,
      formSectionUniqueId: 'shared-section',
    }));
    const def: SurveyDefinition = { ...base, sections, questions };
    const data = inputs([], []);

    const result = resolveSurveyVisibility(def, data.compilation, data.evaluation);

    expect(result.sections.map((item) => item.questionIds)).toEqual([
      ['question-1', 'question-2'],
      ['question-1', 'question-2'],
    ]);
  });

});
