import { ExpressionTargetsEnum, FormExpressionTypeEnum } from '@service-proxies/models';
import { describe, expect, it } from 'vitest';
import type { SurveyFormulaEvaluationContext } from './concrete-runtime-projector';
import { createSurveyFormulaScope } from './formula-scope';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime, advanceSurveyLoop } from '../flow/loop-runtime';

const definition: SurveyDefinition = {
  id: 'survey-scope',
  formGuid: 'form-guid',
  sections: [{ id: 'section', uniqueIdPerForm: 'section-fid', source: {} }],
  questions: [{
    id: 'question-a',
    sourceId: 'question-source',
    uniqueIdPerForm: 'question-fid',
    formSectionUniqueId: 'section-fid',
    title: 'Question A',
    isActive: true,
    isRequired: false,
    options: [
      { id: 'option-a', sourceId: 'option-source-a', uniqueIdPerForm: 'option-fid-a', title: 'Option A', source: {}, settings: null },
      { id: 'option-b', sourceId: 'option-source-b', uniqueIdPerForm: 'option-fid-b', title: 'Option B', source: {}, settings: null },
    ],
    source: {},
    settings: null,
  }],
  expressions: [{
    id: 'section-loop',
    expressionText: 'true',
    isActive: true,
    source: {},
    formExpressionType: FormExpressionTypeEnum.InsideForm,
    targetType: ExpressionTargetsEnum.SectionLoop,
    targetKey: 'section-fid',
  }],
  globalVariables: [],
};

function makeContext(instanceId = 'root'): SurveyFormulaEvaluationContext {
  const answers = createInitialAnswerState(definition);
  return {
    definition,
    graph: { surveyId: definition.id, nodes: [], edges: [], topologicalOrder: [], blockedNodeIds: [], cycleComponents: [], diagnostics: [], isValid: true },
    expressions: { surveyId: definition.id, expressions: [], globalVariables: [], diagnostics: [], isValid: true },
    answers,
    loops: createSurveyLoopRuntime(definition),
    instanceId,
    loopVariables: Object.freeze({}),
  };
}

describe('createSurveyFormulaScope', () => {
  it('projects answers and metadata through separate stable identifier indexes', () => {
    const context = makeContext();
    const question = context.answers.instances.root['question-a'];
    const selected = createInitialAnswerState(definition);
    const scoped = {
      ...context,
      answers: {
        ...selected,
        instances: {
          ...selected.instances,
          root: {
            ...selected.instances.root,
            'question-a': Object.freeze({
              ...question,
              value: 'hello',
              selectedOptionIds: Object.freeze(['option-b']),
              isDirty: true,
            }),
          },
        },
      },
    } as SurveyFormulaEvaluationContext;

    const scope = createSurveyFormulaScope(scoped);
    expect(scope.answers.byQuestionId['question-a']).toMatchObject({
      value: 'hello',
      selectedOptionIds: ['option-b'],
      selectedOptions: [{ id: 'option-b', title: 'Option B' }],
      isDirty: true,
    });
    expect(scope.answers.byQuestionUniqueIdPerForm['question-fid'].value).toBe('hello');
    expect(scope.answers.byQuestionSourceId['question-source'].value).toBe('hello');
    expect(scope.questions.byId['question-a'].title).toBe('Question A');
    expect(Object.isFrozen(scope)).toBe(true);
    expect(Object.isFrozen(scope.answers.byQuestionId['question-a'].selectedOptionIds)).toBe(true);
  });

  it('keeps repeated answer instances and loop variables isolated', () => {
    const context = makeContext();
    const firstAdvance = advanceSurveyLoop(definition, context.loops, context.answers, 'section', true);
    expect(firstAdvance.applied).toBe(true);
    const repeatedContext: SurveyFormulaEvaluationContext = {
      ...context,
      answers: firstAdvance.answerState,
      loops: firstAdvance.runtime,
      instanceId: firstAdvance.createdInstanceId!,
      loopVariables: Object.freeze({ localPrice: '12', iterationLabel: 'second' }),
    };

    const scope = createSurveyFormulaScope(repeatedContext);
    expect(scope.runtime).toMatchObject({
      instanceId: firstAdvance.createdInstanceId,
      isRepeated: true,
      sectionId: 'section',
      iterationIndex: 1,
      backendLoopNumber: 2,
    });
    expect(scope.loop.variables).toEqual({ localPrice: '12', iterationLabel: 'second' });
    expect(scope.answers.byQuestionId['question-a'].value).toBeNull();
    expect(Object.isFrozen(scope.loop.variables)).toBe(true);
  });

  it('rejects unknown answer instances instead of silently creating an empty scope', () => {
    expect(() => createSurveyFormulaScope(makeContext('missing'))).toThrow(
      'Formula scope cannot be created for unknown answer instance: missing',
    );
  });

  it('does not leak selected option indexes between independent scopes', () => {
    const context = makeContext();
    const first = createSurveyFormulaScope(context);
    const second = createSurveyFormulaScope(context);
    expect(first.answers.byQuestionId).not.toBe(second.answers.byQuestionId);
    expect(first.loop.variables).not.toBe(second.loop.variables);
  });
});
