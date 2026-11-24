import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import type { ProposedSurveyAction } from '../definition/full-evaluator';
import { createInitialAnswerState, getQuestionAnswer } from '../state/answer-state.reducer';
import { describe, expect, it } from 'vitest';
import { applySurveyActionTransaction, resolveSurveyActions } from './action-transaction';

function definition(): SurveyDefinition {
  return {
    id: 'survey', sections: [],
    questions: [{
      id: 'q1', source: {}, sourceId: 'question-db-1', uniqueIdPerForm: 'question-form-1',
      isActive: true, isRequired: false, options: [
        { id: 'o1', source: {}, sourceId: 'option-db-1', uniqueIdPerForm: 'option-1', settings: null },
        { id: 'o2', source: {}, sourceId: 'option-db-2', uniqueIdPerForm: 'option-2', settings: null },
      ], settings: null,
    }],
    expressions: [], globalVariables: [],
  };
}
function action(id: string, type: ExpressionActionsEnum, option = 'option-1', conditionMet = true): ProposedSurveyAction {
  return {
    expressionId: id, formulaId: 'formula-' + id, actionType: type,
    targetType: ExpressionTargetsEnum.Answer, targetKey: option,
    formQuestionUniqueId: 'question-db-1',
    formExpressionType: FormExpressionTypeEnum.InsideForm,
    value: conditionMet, conditionMet,
  };
}

describe('survey action transaction', () => {
  it('applies Select and UnSelect as atomic answer commands', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const result = applySurveyActionTransaction(def, state, 'root', [
      action('select', ExpressionActionsEnum.Select),
      action('select-2', ExpressionActionsEnum.Select, 'option-2'),
    ]);
    expect(result.resolution.isValid).toBe(true);
    expect(result.answerResult.applied).toBe(true);
    expect(getQuestionAnswer(result.answerResult.state, 'root', 'q1')?.selectedOptionIds).toEqual(['o1', 'o2']);

    const unselect = applySurveyActionTransaction(def, result.answerResult.state, 'root', [
      action('unselect', ExpressionActionsEnum.UnSelect),
    ]);
    expect(getQuestionAnswer(unselect.answerResult.state, 'root', 'q1')?.selectedOptionIds).toEqual(['o2']);
  });

  it('does nothing when the expression condition is false', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const result = applySurveyActionTransaction(def, state, 'root', [
      action('select-false', ExpressionActionsEnum.Select, 'option-1', false),
    ]);
    expect(result.answerResult.state).toBe(state);
    expect(result.answerResult.changedAnswers).toEqual([]);
  });

  it('rejects conflicting Select and UnSelect by default without partial mutation', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const result = applySurveyActionTransaction(def, state, 'root', [
      action('select', ExpressionActionsEnum.Select),
      action('unselect', ExpressionActionsEnum.UnSelect),
    ]);
    expect(result.resolution.isValid).toBe(false);
    expect(result.resolution.diagnostics[0].code).toBe('ACTION_TARGET_CONFLICT');
    expect(result.answerResult.applied).toBe(false);
    expect(result.answerResult.state).toBe(state);
  });

  it('uses an explicitly selected conflict policy', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const selectWins = applySurveyActionTransaction(def, state, 'root', [
      action('select', ExpressionActionsEnum.Select),
      action('unselect', ExpressionActionsEnum.UnSelect),
    ], { conflictPolicy: 'select-wins' });
    expect(getQuestionAnswer(selectWins.answerResult.state, 'root', 'q1')?.selectedOptionIds).toEqual(['o1']);

    const unselectWins = applySurveyActionTransaction(def, selectWins.answerResult.state, 'root', [
      action('select-2', ExpressionActionsEnum.Select),
      action('unselect-2', ExpressionActionsEnum.UnSelect),
    ], { conflictPolicy: 'unselect-wins' });
    expect(getQuestionAnswer(unselectWins.answerResult.state, 'root', 'q1')?.selectedOptionIds).toEqual([]);
  });

  it('preserves unsupported actions for later handlers', () => {
    const def = definition();
    const unsupported = {
      ...action('end-form', ExpressionActionsEnum.EndForm),
      targetType: ExpressionTargetsEnum.Form,
    };
    const result = resolveSurveyActions(def, 'root', [unsupported]);
    expect(result.commands).toEqual([]);
    expect(result.unhandledActions).toEqual([unsupported]);
    expect(result.isValid).toBe(true);
  });

  it('rejects unknown question or option references', () => {
    const def = definition();
    const result = resolveSurveyActions(def, 'root', [
      { ...action('bad', ExpressionActionsEnum.Select), targetKey: 'missing-option' },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.diagnostics[0].code).toBe('ACTION_OPTION_UNRESOLVED');
  });
});
