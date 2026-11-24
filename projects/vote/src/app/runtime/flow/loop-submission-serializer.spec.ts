import {
  CreateVoterAnswerDetailDto,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  FormSectionTypeEnum,
} from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import {
  advanceSurveyLoop, createSurveyLoopRuntime, setSurveyLoopIterationVariables,
} from './loop-runtime';
import { describe, expect, it } from 'vitest';
import { serializeSurveyLoopSubmission } from './loop-submission-serializer';

function definition(): SurveyDefinition {
  return {
    id: 'survey',
    sections: [{
      id: 'loop', source: {}, sourceId: 'loop-db', uniqueIdPerForm: 'loop-fid',
      type: FormSectionTypeEnum.Normal,
    }],
    questions: [
      { id: 'q1', source: {}, sourceId: 'q1-db', uniqueIdPerForm: 'q1-fid',
        formSectionUniqueId: 'loop-fid', isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q2', source: {}, sourceId: 'q2-db', uniqueIdPerForm: 'q2-fid',
        formSectionUniqueId: 'loop-fid', isActive: true, isRequired: false, options: [], settings: null },
    ],
    expressions: [{
      id: 'loop-exp', source: {}, expressionText: 'true',
      targetType: ExpressionTargetsEnum.SectionLoop, targetKey: 'loop-fid',
      formExpressionType: FormExpressionTypeEnum.InsideForm, isActive: true,
    }],
    globalVariables: [],
  };
}

describe('serializeSurveyLoopSubmission', () => {
  it('serializes only filled iterations in stable order and merges variables with last-write-wins', () => {
    const def = definition();
    const runtime0 = setSurveyLoopIterationVariables(createSurveyLoopRuntime(def), 'loop', 0, { region: 'north', store: 'A' });
    const answers0 = applyAnswerCommands(def, createInitialAnswerState(def), [
      { type: 'set-value', instanceId: 'root', questionId: 'q1', value: 'first-pass' },
      { type: 'set-value', instanceId: 'root', questionId: 'q2', value: 'extra' },
    ]).state;
    const next = advanceSurveyLoop(def, runtime0, answers0, 'loop', true);
    const runtime1 = setSurveyLoopIterationVariables(next.runtime, 'loop', 1, { region: 'south' });
    const answers1 = applyAnswerCommands(def, next.answerState, [
      { type: 'set-value', instanceId: 'loop:loop:1', questionId: 'q1', value: 'second-pass' },
    ]).state;
    const stopped = advanceSurveyLoop(def, runtime1, answers1, 'loop', false);

    const result = serializeSurveyLoopSubmission(
      def, stopped.runtime, stopped.answerState,
      (question, answer, context) => answer.value === null ? [] : [
        new CreateVoterAnswerDetailDto({
          formQuestionUniqueId: question.sourceId,
          answerDescription: String(answer.value),
          dynamicDataRecordId: typeof context.dynamicDataRecordId === 'number'
            ? context.dynamicDataRecordId : undefined,
        }),
      ],
    );

    expect(result.isValid).toBe(true);
    expect(result.formSections).toHaveLength(1);
    expect(result.formSections[0].repeatSections).toHaveLength(2);
    expect(result.formSections[0].repeatSections?.[0].voterAnswerDetails?.map((item) => item.answerDescription))
      .toEqual(['first-pass', 'extra']);
    expect(result.formSections[0].repeatSections?.[1].voterAnswerDetails?.[0].answerDescription)
      .toBe('second-pass');
    expect(result.variablesLastValue).toEqual({ region: 'south', store: 'A' });
  });

  it('omits iterations that have not been advanced or produce no answer details', () => {
    const def = definition();
    const runtime = createSurveyLoopRuntime(def);
    const answers = createInitialAnswerState(def);
    const result = serializeSurveyLoopSubmission(def, runtime, answers, () => []);
    expect(result.formSections).toEqual([]);
    expect(result.variablesLastValue).toEqual({});
  });

  it('returns a diagnostic instead of emitting a partial payload for a missing filled answer instance', () => {
    const def = definition();
    const advanced = advanceSurveyLoop(def, createSurveyLoopRuntime(def), createInitialAnswerState(def), 'loop', false);
    const broken = { ...advanced.answerState, instances: {} };
    const result = serializeSurveyLoopSubmission(def, advanced.runtime, broken, () => []);
    expect(result.isValid).toBe(false);
    expect(result.diagnostics[0].code).toBe('LOOP_SUBMISSION_INSTANCE_MISSING');
    expect(result.formSections).toEqual([]);
  });
});
