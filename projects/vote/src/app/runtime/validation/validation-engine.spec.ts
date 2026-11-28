import { FormQuestionTypesEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import { describe, expect, it } from 'vitest';
import { validateSurveyAnswers } from './validation-engine';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';

function definition(): SurveyDefinition {
  return {
    id: 'survey', sections: [],
    questions: [
      { id: 'required', source: {}, sourceId: 'required-db', uniqueIdPerForm: 'required-fid',
        questionType: FormQuestionTypesEnum.ShortText, isActive: true, isRequired: true, options: [], settings: null },
      { id: 'optional', source: {}, sourceId: 'optional-db', uniqueIdPerForm: 'optional-fid',
        questionType: FormQuestionTypesEnum.ShortText, isActive: true, isRequired: false, options: [], settings: null },
      { id: 'point', source: {}, sourceId: 'point-db', uniqueIdPerForm: 'point-fid',
        questionType: FormQuestionTypesEnum.Point, isActive: true, isRequired: true,
        minimumAnswer: 1, maximumAnswer: 5, options: [], settings: null },
      { id: 'hidden', source: {}, sourceId: 'hidden-db', uniqueIdPerForm: 'hidden-fid',
        questionType: FormQuestionTypesEnum.ShortText, isActive: true, isRequired: true, options: [], settings: null },
    ],
    expressions: [], globalVariables: [],
  };
}
function visibility(def: SurveyDefinition, hidden: boolean | null = false): SurveyVisibilityResult {
  return {
    surveyId: def.id,
    questions: def.questions.map((q) => ({
      questionId: q.id, isVisible: q.id === 'hidden' ? hidden : true, options: [],
    })),
    sections: [], unhandledActions: [], diagnostics: [], isValid: true,
  };
}

describe('validateSurveyAnswers', () => {
  it('reports required questions and accepts false and zero as supplied values', () => {
    const def = definition();
    let state = createInitialAnswerState(def);
    state = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'optional', value: false },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 0 },
    ]).state;
    const result = validateSurveyAnswers(def, state, visibility(def), 'root');
    expect(result.isValid).toBe(false);
    expect(result.issues.map((item) => item.code)).toContain('QUESTION_REQUIRED');
    expect(result.questions.find((item) => item.questionId === 'optional')?.status).toBe('valid');
  });

  it('validates Point numeric bounds', () => {
    const def = definition();
    let state = createInitialAnswerState(def);
    state = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'done' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 8 },
    ]).state;
    const result = validateSurveyAnswers(def, state, visibility(def), 'root');
    expect(result.issues.map((item) => item.code)).toContain('POINT_ANSWER_OUT_OF_RANGE');
  });

  it('applies scalar type rules again at the runtime submission boundary', () => {
    const base = definition();
    const def: SurveyDefinition = {
      ...base,
      questions: [
        ...base.questions,
        { id: 'mobile', source: {}, questionType: FormQuestionTypesEnum.Mobile, isActive: true,
          isRequired: true, options: [], settings: null },
        { id: 'national', source: {}, questionType: FormQuestionTypesEnum.NationalCode, isActive: true,
          isRequired: true, options: [], settings: null },
        { id: 'numeric', source: {}, questionType: FormQuestionTypesEnum.Numeric, isActive: true,
          isRequired: true, minimumAnswer: 2, maximumAnswer: 9,
          options: [], settings: { isDecimal: true, maxDecimalDigit: 2 } },
        { id: 'masked', source: {}, questionType: FormQuestionTypesEnum.CustomMaskShortText, isActive: true,
          isRequired: true, options: [], settings: { maskRegEx: '^\\d+
    const def = definition();
    const state = createInitialAnswerState(def);
    const hidden = validateSurveyAnswers(def, state, visibility(def, false), 'root');
    expect(hidden.questions.find((item) => item.questionId === 'hidden')?.status).toBe('skipped');
    const validState = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'answered' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 3 },
    ]).state;
    const unknown = validateSurveyAnswers(def, validState, visibility(def, null), 'root');
    expect(unknown.questions.find((item) => item.questionId === 'hidden')?.status).toBe('unknown');
    expect(unknown.isValid).toBe(null);
  });

  it('rejects unknown selected options and missing instances', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const root = state.instances['root'];
    const corrupted = {
      ...state,
      instances: {
        ...state.instances,
        root: {
          ...root,
          optional: { ...root['optional'], selectedOptionIds: ['not-real'] },
        },
      },
    };
    const invalid = validateSurveyAnswers(def, corrupted, visibility(def), 'root');
    expect(invalid.issues.map((item) => item.code)).toContain('ANSWER_OPTION_UNKNOWN');
    const missing = validateSurveyAnswers(def, state, visibility(def), 'missing');
    expect(missing.isValid).toBe(false);
    expect(missing.issues[0].code).toBe('VALIDATION_INSTANCE_UNKNOWN');
  });

  it('does not apply Point bounds to other question types', () => {
    const def = definition();
    let state = createInitialAnswerState(def);
    state = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'done' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 5 },
      { type: 'set-value', instanceId: 'root', questionId: 'optional', value: 999 },
    ]).state;
    const result = validateSurveyAnswers(def, state, visibility(def), 'root');
    expect(result.issues).toEqual([]);
  });
});
 } },
      ],
    };
    let state = createInitialAnswerState(def);
    state = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'ok' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 3 },
      { type: 'set-value', instanceId: 'root', questionId: 'mobile', value: '0912123456' },
      { type: 'set-value', instanceId: 'root', questionId: 'national', value: '1111111111' },
      { type: 'set-value', instanceId: 'root', questionId: 'numeric', value: 1.234 },
      { type: 'set-value', instanceId: 'root', questionId: 'masked', value: '12x' },
    ]).state;
    const result = validateSurveyAnswers(def, state, visibility(def), 'root');
    expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining([
      'ANSWER_MOBILE_INVALID',
      'ANSWER_NATIONAL_CODE_INVALID',
      'ANSWER_BELOW_MINIMUM',
      'ANSWER_CUSTOM_MASK_INVALID',
    ]));
    expect(result.isValid).toBe(false);
  });

  it('skips hidden required questions and reports unknown visibility as indeterminate', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const hidden = validateSurveyAnswers(def, state, visibility(def, false), 'root');
    expect(hidden.questions.find((item) => item.questionId === 'hidden')?.status).toBe('skipped');
    const validState = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'answered' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 3 },
    ]).state;
    const unknown = validateSurveyAnswers(def, validState, visibility(def, null), 'root');
    expect(unknown.questions.find((item) => item.questionId === 'hidden')?.status).toBe('unknown');
    expect(unknown.isValid).toBe(null);
  });

  it('rejects unknown selected options and missing instances', () => {
    const def = definition();
    const state = createInitialAnswerState(def);
    const root = state.instances['root'];
    const corrupted = {
      ...state,
      instances: {
        ...state.instances,
        root: {
          ...root,
          optional: { ...root['optional'], selectedOptionIds: ['not-real'] },
        },
      },
    };
    const invalid = validateSurveyAnswers(def, corrupted, visibility(def), 'root');
    expect(invalid.issues.map((item) => item.code)).toContain('ANSWER_OPTION_UNKNOWN');
    const missing = validateSurveyAnswers(def, state, visibility(def), 'missing');
    expect(missing.isValid).toBe(false);
    expect(missing.issues[0].code).toBe('VALIDATION_INSTANCE_UNKNOWN');
  });

  it('does not apply Point bounds to other question types', () => {
    const def = definition();
    let state = createInitialAnswerState(def);
    state = applyAnswerCommands(def, state, [
      { type: 'set-value', instanceId: 'root', questionId: 'required', value: 'done' },
      { type: 'set-value', instanceId: 'root', questionId: 'point', value: 5 },
      { type: 'set-value', instanceId: 'root', questionId: 'optional', value: 999 },
    ]).state;
    const result = validateSurveyAnswers(def, state, visibility(def), 'root');
    expect(result.issues).toEqual([]);
  });
});
