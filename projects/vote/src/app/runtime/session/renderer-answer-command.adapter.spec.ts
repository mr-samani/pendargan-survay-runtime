import { describe, expect, it } from 'vitest';
import type { SurveyDefinition } from '../definition/definition.types';
import { compileRendererAnswerChange } from './renderer-answer-command.adapter';

const definition: SurveyDefinition = {
  id: 'survey', sections: [],
  questions: [{
    id: 'question-id', source: {}, sourceId: 'question-source', uniqueIdPerForm: 'question-form',
    isActive: true, isRequired: false, settings: null,
    options: [
      { id: 'option-a', source: {}, sourceId: 'option-source-a', uniqueIdPerForm: 'option-form-a', settings: null },
      { id: 'option-b', source: {}, sourceId: 'option-source-b', uniqueIdPerForm: 'option-form-b', settings: null },
    ],
  }],
  expressions: [], globalVariables: [],
};

describe('compileRendererAnswerChange', () => {
  it('maps single choice references to canonical IDs and the active answer instance', () => {
    const result = compileRendererAnswerChange(definition, 'loop:section:1', {
      kind: 'single-choice', questionRef: 'question-form', optionRef: 'option-form-b',
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.commands).toEqual([{
      type: 'set-selected-options', instanceId: 'loop:section:1',
      questionId: 'question-id', optionIds: ['option-b'],
    }]);
  });

  it('maps multiple choices using stable references, not renderer order', () => {
    const result = compileRendererAnswerChange(definition, 'root', {
      kind: 'multiple-choice', questionRef: 'question-source',
      optionRefs: ['option-source-b', 'option-source-a'],
    });
    expect(result.commands[0]).toMatchObject({
      type: 'set-selected-options', instanceId: 'root',
      questionId: 'question-id', optionIds: ['option-b', 'option-a'],
    });
  });

  it('compiles dynamic-data payloads as atomic JSON-safe set-value commands', () => {
    const value = {
      identificationCode: 42,
      answerTitle: 'Product',
      jsonValuesDictionary: { City: 'Isfahan', Count: '3' },
    };
    const result = compileRendererAnswerChange(definition, 'root', {
      kind: 'question-value', questionRef: 'question-source', value,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.commands).toEqual([{
      type: 'set-value', instanceId: 'root', questionId: 'question-id', value,
    }]);
  });

  it('compiles matrix column selections and cell values as one atomic command batch', () => {
    const value = { 'option-form-a': 'blue', 'option-form-b': 12 };
    const result = compileRendererAnswerChange(definition, 'loop:matrix:0', {
      kind: 'matrix-cells',
      questionRef: 'question-form',
      optionRefs: ['option-form-a', 'option-form-b'],
      value,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.commands).toEqual([
      {
        type: 'set-selected-options', instanceId: 'loop:matrix:0',
        questionId: 'question-id', optionIds: ['option-a', 'option-b'],
      },
      {
        type: 'set-value', instanceId: 'loop:matrix:0',
        questionId: 'question-id', value,
      },
    ]);
  });

  it('rejects unknown and ambiguous question references', () => {
    const unknown = compileRendererAnswerChange(definition, 'root', {
      kind: 'single-choice', questionRef: 'missing', optionRef: 'option-form-a',
    });
    expect(unknown.diagnostics[0].code).toBe('RENDERER_QUESTION_REFERENCE_UNRESOLVED');

    const ambiguousDefinition = {
      ...definition, questions: [...definition.questions, { ...definition.questions[0], id: 'duplicate' }],
    };
    const ambiguous = compileRendererAnswerChange(ambiguousDefinition, 'root', {
      kind: 'single-choice', questionRef: 'question-form', optionRef: 'option-form-a',
    });
    expect(ambiguous.diagnostics[0].code).toBe('RENDERER_QUESTION_REFERENCE_UNRESOLVED');
  });

  it('rejects unknown and duplicate options atomically', () => {
    const duplicate = compileRendererAnswerChange(definition, 'root', {
      kind: 'multiple-choice', questionRef: 'question-id',
      optionRefs: ['option-a', 'option-form-a'],
    });
    expect(duplicate.diagnostics[0].code).toBe('RENDERER_OPTION_REFERENCE_DUPLICATED');

    const unknown = compileRendererAnswerChange(definition, 'root', {
      kind: 'multiple-choice', questionRef: 'question-id', optionRefs: ['option-form-a', 'missing'],
    });
    expect(unknown.diagnostics[0].code).toBe('RENDERER_OPTION_REFERENCE_UNRESOLVED');
  });
});
