import { ExpressionTargetsEnum, FormSectionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState, applyAnswerCommands } from '../state/answer-state.reducer';
import { describe, expect, it } from 'vitest';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import {
  advanceSurveyLoop, advanceSurveyLoopFromEvaluation, createSurveyLoopRuntime, getSurveyLoopIteration,
  resolveSurveyLoopDecision, setSurveyLoopIterationVariables,
} from './loop-runtime';

function definition(): SurveyDefinition {
  return {
    id: 'survey',
    sections: [
      { id: 'normal', source: {}, sourceId: 'normal-db', uniqueIdPerForm: 'normal-fid', type: FormSectionTypeEnum.Normal },
      { id: 'loop', source: {}, sourceId: 'loop-db', uniqueIdPerForm: 'loop-fid', type: FormSectionTypeEnum.Normal },
    ],
    questions: [
      { id: 'q-normal', source: {}, sourceId: 'q-normal-db', uniqueIdPerForm: 'q-normal-fid',
        formSectionUniqueId: 'normal-fid', isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q-loop-a', source: {}, sourceId: 'q-loop-a-db', uniqueIdPerForm: 'q-loop-a-fid',
        formSectionUniqueId: 'loop-fid', isActive: true, isRequired: false, options: [], settings: null },
      { id: 'q-loop-b', source: {}, sourceId: 'q-loop-b-db', uniqueIdPerForm: 'q-loop-b-fid',
        formSectionUniqueId: 'loop-fid', parentUniqueId: 'q-loop-a-fid', isActive: true, isRequired: false,
        options: [], settings: null },
    ],
    expressions: [{
      id: 'loop-expression', source: {}, expressionText: 'continueLoop',
      targetType: ExpressionTargetsEnum.SectionLoop, targetKey: 'loop-fid', isActive: true,
    }],
    globalVariables: [],
  };
}

describe('survey loop runtime', () => {
  it('detects loop sections from the legacy SectionLoop expression target', () => {
    const def = definition();
    const runtime = createSurveyLoopRuntime(def);
    expect(Object.keys(runtime.sections)).toEqual(['loop']);
    expect(runtime.sections['loop'].iterations[0].answerInstanceId).toBe('root');
    expect(runtime.sections['loop'].iterations[0].backendLoopNumber).toBe(1);
  });

  it('creates isolated answer instances for repeated passes and keeps root for pass zero', () => {
    const def = definition();
    const runtime = createSurveyLoopRuntime(def);
    const answers = createInitialAnswerState(def);
    const first = applyAnswerCommands(def, answers, [
      { type: 'set-value', instanceId: 'root', questionId: 'q-loop-a', value: 'first' },
    ]).state;
    const repeated = advanceSurveyLoop(def, runtime, first, 'loop', true);
    expect(repeated.applied).toBe(true);
    expect(repeated.createdInstanceId).toBe('loop:loop:1');
    expect(repeated.runtime.sections['loop'].iterations.map((item) => item.iterationIndex)).toEqual([0, 1]);
    expect(repeated.runtime.sections['loop'].iterations[0].status).toBe('completed');
    expect(repeated.runtime.sections['loop'].iterations[1].answerInstanceId).toBe('loop:loop:1');
    expect(repeated.answerState.instances['loop:loop:1']['q-loop-a'].value).toBe(null);
    expect(repeated.answerState.instances['loop:loop:1']['q-loop-b']).toBeDefined();
    expect(repeated.answerState.instances['root']['q-loop-a'].value).toBe('first');
  });

  it('connects the SectionLoop proposal from formula evaluation to the iteration transition', () => {
    const def = definition();
    const evaluation = {
      surveyId: 'survey',
      formulaResults: [],
      globalVariableValues: [],
      proposedActions: [{
        expressionId: 'loop-expression',
        formulaId: 'survey::expression::loop-expression',
        actionType: undefined,
        targetType: ExpressionTargetsEnum.SectionLoop,
        targetKey: 'loop-fid',
        formQuestionUniqueId: null,
        formExpressionType: undefined,
        value: true,
        conditionMet: true,
      }],
      diagnostics: [],
      isValid: true,
    } as unknown as SurveyFullEvaluationResult;
    expect(resolveSurveyLoopDecision(def, evaluation, 'loop')).toBe(true);
    const result = advanceSurveyLoopFromEvaluation(
      def, createSurveyLoopRuntime(def), createInitialAnswerState(def), 'loop', evaluation,
    );
    expect(result.applied).toBe(true);
    expect(result.createdInstanceId).toBe('loop:loop:1');
  });

  it('closes a loop when the SectionLoop expression is false', () => {
    const def = definition();
    const result = advanceSurveyLoop(def, createSurveyLoopRuntime(def), createInitialAnswerState(def), 'loop', false);
    expect(result.applied).toBe(true);
    expect(result.runtime.sections['loop'].isComplete).toBe(true);
    expect(result.runtime.sections['loop'].iterations[0].status).toBe('completed');
  });

  it('does not advance on an unknown decision and enforces a finite iteration limit', () => {
    const def = definition();
    const runtime = createSurveyLoopRuntime(def, 2);
    const answers = createInitialAnswerState(def);
    const unknown = advanceSurveyLoop(def, runtime, answers, 'loop', null);
    expect(unknown.applied).toBe(false);
    expect(unknown.diagnostics[0].code).toBe('LOOP_DECISION_UNKNOWN');
    const second = advanceSurveyLoop(def, runtime, answers, 'loop', true);
    const third = advanceSurveyLoop(def, second.runtime, second.answerState, 'loop', true);
    expect(third.applied).toBe(false);
    expect(third.diagnostics[0].code).toBe('LOOP_MAX_ITERATIONS_REACHED');
  });

  it('stores iteration-specific variables without mutating earlier snapshots', () => {
    const def = definition();
    const runtime = createSurveyLoopRuntime(def);
    const withFirst = setSurveyLoopIterationVariables(runtime, 'loop', 0, { region: 'north' });
    const next = advanceSurveyLoop(def, withFirst, createInitialAnswerState(def), 'loop', true);
    const withSecond = setSurveyLoopIterationVariables(next.runtime, 'loop', 1, { region: 'south' });
    expect(getSurveyLoopIteration(withSecond, 'loop', 0)?.variables).toEqual({ region: 'north' });
    expect(getSurveyLoopIteration(withSecond, 'loop', 1)?.variables).toEqual({ region: 'south' });
    expect(runtime.sections['loop'].iterations[0].variables).toEqual({});
  });
});
