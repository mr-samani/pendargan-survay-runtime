import {
  GetAllFormDetailForViewOutputDto,
  GetFormQuestionQuestionOptionDto,
  GetQuestionOptionDto,
} from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import { compileSurveyDefinition } from '../definition/definition.compiler';
import {
  addAnswerInstance,
  applyAnswerCommands,
  createInitialAnswerState,
  getQuestionAnswer,
} from './answer-state.reducer';

function createDefinition() {
  return compileSurveyDefinition(new GetAllFormDetailForViewOutputDto({
    formGuid: 'answer-survey',
    formQuestions: [
      new GetFormQuestionQuestionOptionDto({
        uniqueIdPerForm: 'question-1',
        questionOptions: [
          new GetQuestionOptionDto({ uniqueIdPerForm: 'option-b', rowNumber: 2 }),
          new GetQuestionOptionDto({ uniqueIdPerForm: 'option-a', rowNumber: 1 }),
        ],
      }),
      new GetFormQuestionQuestionOptionDto({
        uniqueIdPerForm: 'question-2',
      }),
    ],
  })).definition;
}

describe('answer state reducer', () => {
  it('creates a frozen root answer instance for every definition question', () => {
    const definition = createDefinition();
    const state = createInitialAnswerState(definition);

    expect(state.surveyId).toBe('answer-survey');
    expect(state.revision).toBe(0);
    expect(Object.keys(state.instances.root)).toEqual(['question-1', 'question-2']);
    expect(getQuestionAnswer(state, 'root', 'question-1')).toMatchObject({
      value: null,
      selectedOptionIds: [],
      isDirty: false,
      updatedAtRevision: 0,
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.instances.root['question-1'])).toBe(true);
  });

  it('creates isolated answer namespaces for repeated runtime instances', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const added = addAnswerInstance(initial, definition, 'loop-1', ['question-1']);

    expect(added.applied).toBe(true);
    expect(added.state.revision).toBe(1);
    expect(Object.keys(added.state.instances['loop-1'])).toEqual(['question-1']);

    const changed = applyAnswerCommands(definition, added.state, [
      {
        type: 'set-value',
        instanceId: 'loop-1',
        questionId: 'question-1',
        value: 'loop answer',
      },
    ]);

    expect(getQuestionAnswer(changed.state, 'loop-1', 'question-1')?.value).toBe('loop answer');
    expect(getQuestionAnswer(changed.state, 'root', 'question-1')?.value).toBe(null);
  });

  it('applies a batch atomically and increments revision once', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const result = applyAnswerCommands(definition, initial, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-2',
        value: 'typed value',
      },
      {
        type: 'set-selected-options',
        instanceId: 'root',
        questionId: 'question-1',
        optionIds: ['option-b', 'option-a', 'option-b'],
      },
    ]);

    expect(result.applied).toBe(true);
    expect(result.state.revision).toBe(1);
    expect(result.changedAnswers).toHaveLength(2);
    expect(getQuestionAnswer(result.state, 'root', 'question-1')?.selectedOptionIds).toEqual([
      'option-a',
      'option-b',
    ]);
    expect(getQuestionAnswer(result.state, 'root', 'question-2')?.value).toBe('typed value');
    expect(getQuestionAnswer(result.state, 'root', 'question-2')?.updatedAtRevision).toBe(1);
  });

  it('rejects the entire batch if any option reference is invalid', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const result = applyAnswerCommands(definition, initial, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-2',
        value: 'must not commit',
      },
      {
        type: 'toggle-option',
        instanceId: 'root',
        questionId: 'question-1',
        optionId: 'not-an-option',
        selected: true,
      },
    ]);

    expect(result.applied).toBe(false);
    expect(result.state).toBe(initial);
    expect(result.state.revision).toBe(0);
    expect(result.diagnostics.map((item) => item.code)).toContain('ANSWER_OPTION_UNKNOWN');
  });

  it('treats structurally equal values and repeated selections as no-ops', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const first = applyAnswerCommands(definition, initial, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-2',
        value: { nested: [1, 2] },
      },
    ]);
    const noOp = applyAnswerCommands(definition, first.state, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-2',
        value: { nested: [1, 2] },
      },
    ]);

    expect(noOp.state).toBe(first.state);
    expect(noOp.state.revision).toBe(1);
    expect(noOp.changedAnswers).toHaveLength(0);
  });

  it('clones and freezes nested JSON values without freezing the caller object', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const value = { nested: { enabled: true } };
    const result = applyAnswerCommands(definition, initial, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-2',
        value,
      },
    ]);
    const stored = getQuestionAnswer(result.state, 'root', 'question-2')?.value as {
      nested: { enabled: boolean };
    };

    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.nested)).toBe(true);
    value.nested.enabled = false;
    expect(stored.nested.enabled).toBe(true);
  });

  it('clears both the raw value and selected options', () => {
    const definition = createDefinition();
    const initial = createInitialAnswerState(definition);
    const set = applyAnswerCommands(definition, initial, [
      {
        type: 'set-value',
        instanceId: 'root',
        questionId: 'question-1',
        value: 'raw',
      },
      {
        type: 'set-selected-options',
        instanceId: 'root',
        questionId: 'question-1',
        optionIds: ['option-a'],
      },
    ]);
    const cleared = applyAnswerCommands(definition, set.state, [
      { type: 'clear', instanceId: 'root', questionId: 'question-1' },
    ]);

    expect(getQuestionAnswer(cleared.state, 'root', 'question-1')).toMatchObject({
      value: null,
      selectedOptionIds: [],
      isDirty: true,
    });
  });
});
