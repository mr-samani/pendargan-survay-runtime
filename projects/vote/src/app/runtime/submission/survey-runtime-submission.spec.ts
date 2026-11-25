import { describe, expect, it } from 'vitest';
import {
  ExpressionActionsEnum,
  FormQuestionTypesEnum,
  FormExpressionTypeEnum,
  FormSectionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime, advanceSurveyLoop } from '../flow/loop-runtime';
import type { SurveyRuntimeSessionSnapshot } from '../session/runtime-session';
import { buildSurveyRuntimeSubmission } from './survey-runtime-submission';

function definition(): SurveyDefinition {
  return {
    id: 'runtime-submit',
    sections: [
      { id: 'ordinary', source: {}, sourceId: 'ordinary-db', uniqueIdPerForm: 'ordinary-ref', type: FormSectionTypeEnum.Normal },
      { id: 'repeat', source: {}, sourceId: 'repeat-db', uniqueIdPerForm: 'repeat-ref', type: FormSectionTypeEnum.Normal },
    ],
    questions: [
      { id: 'plain-q', source: { uniqueId: 'plain-db' }, sourceId: 'plain-db', uniqueIdPerForm: 'plain-ref',
        questionType: FormQuestionTypesEnum.ShortText, formSectionUniqueId: 'ordinary-ref',
        isActive: true, isRequired: false, options: [], settings: null },
      { id: 'loop-q', source: { uniqueId: 'loop-db' }, sourceId: 'loop-db', uniqueIdPerForm: 'loop-ref',
        questionType: FormQuestionTypesEnum.Numeric, formSectionUniqueId: 'repeat-ref',
        isActive: true, isRequired: false, options: [], settings: null },
    ],
    expressions: [{
      id: 'loop-exp', source: {}, expressionText: 'true',
      targetType: 0 as any, targetKey: 'repeat-ref',
      formExpressionType: FormExpressionTypeEnum.InsideForm, isActive: true,
    }],
    globalVariables: [],
  };
}

function session(def: SurveyDefinition): SurveyRuntimeSessionSnapshot {
  const root = applyAnswerCommands(def, createInitialAnswerState(def), [
    { type: 'set-value', instanceId: 'root', questionId: 'plain-q', value: 'root answer' },
    { type: 'set-value', instanceId: 'root', questionId: 'loop-q', value: 'first loop' },
  ]).state;
  const loops = createSurveyLoopRuntime(def);
  const stopped = advanceSurveyLoop(def, loops, root, 'repeat', false);
  const answers = applyAnswerCommands(def, stopped.answerState, [
    { type: 'set-value', instanceId: 'root', questionId: 'plain-q', value: 'root answer' },
  ]).state;
  return {
    surveyId: def.id, revision: 1, answers, loops: stopped.runtime,
    currentPageId: 'page',
    globalVariableValuesByInstance: {},
    legacyRuntimeStateByInstance: {},
    projection: {
      answerState: answers,
      evaluation: {
        surveyId: def.id, formulaResults: [], globalVariableValues: [], proposedActions: [],
        diagnostics: [], isValid: true,
      },
      visibility: {
        surveyId: def.id,
        questions: [
          { questionId: 'plain-q', isVisible: true, options: [] },
          { questionId: 'loop-q', isVisible: true, options: [] },
        ],
        sections: [], unhandledActions: [], diagnostics: [], isValid: true,
      },
      flow: {
        surveyId: def.id, mode: 'section',
        pages: [{ id: 'page', kind: 'section', sectionId: 'repeat', questionIds: ['loop-q'], answerInstanceId: 'root', loopIterationIndex: 0, backendLoopNumber: 1 }],
        visibleQuestionIds: ['plain-q', 'loop-q'], visibleSectionIds: ['ordinary', 'repeat'],
        unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
      },
      validation: {
        surveyId: def.id, instanceId: 'root', answerRevision: answers.revision,
        questions: [], issues: [], isValid: true,
      },
    },
  };
}

const metadata = {
  formGuid: 'form-guid', elapsedTime: 12, temporarySave: false,
};

describe('buildSurveyRuntimeSubmission', () => {
  it('serializes ordinary root sections and loop sections into one payload', () => {
    const def = definition();
    const current = session(def);
    const result = buildSurveyRuntimeSubmission(def, current, metadata);
    expect(result.projection.isValid).toBe(true);
    expect(result.projection.formSections).toHaveLength(2);
    expect(result.projection.formSections[0].repeatSections?.[0].voterAnswerDetails?.[0].answerDescription)
      .toBe('root answer');
    expect(result.projection.formSections[1].repeatSections?.[0].voterAnswerDetails?.[0].answerDescription)
      .toBe('first loop');
    expect(result.payload.isValid).toBe(true);
    expect(result.payload.dto?.guid).toBe('form-guid');
  });

  it('rejects a session with invalid validation instead of producing a partial DTO', () => {
    const def = definition();
    const current = session(def);
    const invalid = {
      ...current,
      projection: { ...current.projection, validation: { ...current.projection.validation, isValid: false } },
    };
    const result = buildSurveyRuntimeSubmission(def, invalid, metadata);
    expect(result.projection.isValid).toBe(false);
    expect(result.projection.formSections).toEqual([]);
    expect(result.payload.isValid).toBe(false);
  });

  it('excludes hidden questions and options using the live visibility projection', () => {
    const def = definition();
    const current = session(def);
    const hidden = {
      ...current,
      projection: {
        ...current.projection,
        visibility: {
          ...current.projection.visibility,
          questions: [
            { questionId: 'plain-q', isVisible: false, options: [] },
            { questionId: 'loop-q', isVisible: true, options: [] },
          ],
        },
      },
    };
    const result = buildSurveyRuntimeSubmission(def, hidden, metadata);
    expect(result.projection.formSections).toHaveLength(1);
    expect(result.projection.formSections[0].repeatSections?.[0].voterAnswerDetails?.[0].formQuestionUniqueId)
      .toBe('loop-db');
  });
});
