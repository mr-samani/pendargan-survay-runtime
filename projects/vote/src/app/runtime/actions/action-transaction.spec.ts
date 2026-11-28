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

  it('combines repeated Select conditions with AND before applying the action', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const result = applySurveyActionTransaction(def, state, 'root', [
      action('select-true', ExpressionActionsEnum.Select, 'option-1', true),
      action('select-false', ExpressionActionsEnum.Select, 'option-1', false),
    ]);
    expect(result.resolution.isValid).toBe(true);
    expect(result.answerResult.state).toBe(state);
    expect(result.answerResult.changedAnswers).toEqual([]);
  });

  it('applies UnSelect when every UnSelect condition is true even if a Select condition is false', () => {
    const def = definition();
    const initial = createInitialAnswerState(def);
    const selected = applySurveyActionTransaction(def, initial, 'root', [
      action('initial-select', ExpressionActionsEnum.Select),
    ]).answerResult.state;
    const result = applySurveyActionTransaction(def, selected, 'root', [
      action('select-false', ExpressionActionsEnum.Select, 'option-1', false),
      action('unselect-true', ExpressionActionsEnum.UnSelect, 'option-1', true),
    ]);
    expect(getQuestionAnswer(result.answerResult.state, 'root', 'q1')?.selectedOptionIds).toEqual([]);
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
  it('preserves first-match behavior when question and option aliases collide', () => {
    const base = definition();
    const first = base.questions[0];
    const second = {
      ...first,
      id: 'q2',
      sourceId: 'question-db-1',
      uniqueIdPerForm: 'question-form-2',
      options: [
        { id: 'o2-first', source: {}, sourceId: 'option-db-1', uniqueIdPerForm: 'option-2-first', settings: null },
        { id: 'o2-second', source: {}, sourceId: 'option-db-2', uniqueIdPerForm: 'option-2-second', settings: null },
      ],
    };
    const def: SurveyDefinition = { ...base, questions: [first, second] };
    const result = resolveSurveyActions(def, 'root', [
      action('duplicate-alias', ExpressionActionsEnum.Select, 'option-db-1'),
    ]);

    expect(result.isValid).toBe(true);
    expect(result.commands).toEqual([{
      type: 'toggle-option',
      instanceId: 'root',
      questionId: 'q1',
      optionId: 'o1',
      selected: true,
    }]);
  });

  it('resolves every supported question and option alias through the cached index', () => {
    const def = definition();
    const references = [
      ['question-db-1', 'option-db-1'],
      ['question-form-1', 'option-1'],
      ['q1', 'o1'],
    ] as const;

    for (const [questionReference, optionReference] of references) {
      const result = resolveSurveyActions(def, 'root', [{
        ...action('alias-' + questionReference, ExpressionActionsEnum.Select, optionReference),
        formQuestionUniqueId: questionReference,
      }]);
      expect(result.isValid).toBe(true);
      expect(result.commands[0]).toMatchObject({ questionId: 'q1', optionId: 'o1' });
    }
  });

  it('preserves first option when aliases collide inside the resolved question', () => {
    const base = definition();
    const question = {
      ...base.questions[0],
      options: [
        { id: 'first-option', source: {}, sourceId: 'shared-option-reference', uniqueIdPerForm: 'first-fid', settings: null },
        { id: 'second-option', source: {}, sourceId: 'shared-option-reference', uniqueIdPerForm: 'second-fid', settings: null },
      ],
    };
    const def: SurveyDefinition = { ...base, questions: [question] };
    const result = resolveSurveyActions(def, 'root', [
      action('duplicate-option-alias', ExpressionActionsEnum.Select, 'shared-option-reference'),
    ]);

    expect(result.commands).toEqual([{
      type: 'toggle-option',
      instanceId: 'root',
      questionId: 'q1',
      optionId: 'first-option',
      selected: true,
    }]);
  });

});
