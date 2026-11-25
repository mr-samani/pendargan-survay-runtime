import { describe, expect, it, vi } from 'vitest';
import { QuestionRuntimeEventBus } from '../../questions/shared/question-runtime-event-bus';
import type { SurveyDefinition } from '../definition/definition.types';
import { addAnswerInstance, createInitialAnswerState } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import type { SurveyRuntimeSessionProjection, SurveyRuntimeSessionProjector } from './runtime-session';
import { RendererRuntimeSessionBridge } from './renderer-runtime-session-bridge';

const definition: SurveyDefinition = {
  id: 'renderer-bridge-survey',
  sections: [{ id: 'section', source: {}, uniqueIdPerForm: 'section-ref' }],
  questions: [{
    id: 'question', source: {}, sourceId: 'question-source', uniqueIdPerForm: 'question-ref',
    formSectionUniqueId: 'section-ref', isActive: true, isRequired: false, settings: null,
    options: [
      { id: 'option-a', source: {}, sourceId: 'option-source-a', uniqueIdPerForm: 'option-ref-a', settings: null },
      { id: 'option-b', source: {}, sourceId: 'option-source-b', uniqueIdPerForm: 'option-ref-b', settings: null },
    ],
  }],
  expressions: [],
  globalVariables: [],
};

function createProjector(includeLoopPage = false): SurveyRuntimeSessionProjector {
  return {
    project: (_definition, answers, _loops, instanceId): SurveyRuntimeSessionProjection => ({
      answerState: answers,
      evaluation: {
        surveyId: definition.id, formulaResults: [], globalVariableValues: [],
        proposedActions: [], diagnostics: [], isValid: true,
      },
      visibility: {
        surveyId: definition.id,
        questions: [{ questionId: 'question', isVisible: true, options: [] }],
        sections: [{ sectionId: 'section', isVisible: true, questionIds: ['question'] }],
        unhandledActions: [], diagnostics: [], isValid: true,
      },
      flow: {
        surveyId: definition.id, mode: 'section',
        pages: [
          { id: 'page', kind: 'section', sectionId: 'section', questionIds: ['question'], answerInstanceId: 'root' },
          ...(includeLoopPage ? [{
            id: 'loop-page', kind: 'section' as const, sectionId: 'section',
            questionIds: ['question'], answerInstanceId: 'loop:section:0', loopIterationIndex: 0, backendLoopNumber: 1,
          }] : []),
        ],
        visibleQuestionIds: ['question'], visibleSectionIds: ['section'],
        unresolvedQuestionIds: [], unresolvedSectionIds: [],
        diagnostics: [], isReady: true, isValid: true,
      },
      validation: {
        surveyId: definition.id, instanceId, answerRevision: answers.revision,
        questions: [{ questionId: 'question', status: 'valid', issues: [] }],
        issues: [], isValid: true,
      },
    }),
  };
}

describe('RendererRuntimeSessionBridge', () => {
  it('subscribes only after restored answers have been committed and dispatches canonical IDs', () => {
    const bus = new QuestionRuntimeEventBus();
    const accepted: number[] = [];
    const bridge = new RendererRuntimeSessionBridge(bus, (session) => accepted.push(session.revision));
    bus.publishAnswerChange({
      kind: 'single-choice', questionRef: 'question-ref', optionRef: 'option-ref-b',
    });

    const started = bridge.start(definition, {
      answerState: createInitialAnswerState(definition),
      loopRuntime: createSurveyLoopRuntime(definition),
    }, createProjector());

    expect(started.applied).toBe(true);
    expect(bridge.session?.answers.instances['root']['question'].selectedOptionIds).toEqual([]);
    bus.publishAnswerChange({
      kind: 'single-choice', questionRef: 'question-ref', optionRef: 'option-ref-b',
    });

    expect(bridge.session?.answers.instances['root']['question'].selectedOptionIds).toEqual(['option-b']);
    expect(accepted).toEqual([0, 1]);
  });

  it('routes renderer events to the currently active repeated answer instance', () => {
    const bus = new QuestionRuntimeEventBus();
    const bridge = new RendererRuntimeSessionBridge(bus);
    const root = createInitialAnswerState(definition);
    const withLoop = addAnswerInstance(root, definition, 'loop:section:0', ['question']);
    expect(withLoop.applied).toBe(true);

    bridge.start(definition, {
      answerState: withLoop.state,
      loopRuntime: createSurveyLoopRuntime(definition),
    }, createProjector(true));

    const navigated = bridge.next();
    expect(navigated.applied).toBe(true);
    expect(bridge.activeAnswerInstanceId).toBe('loop:section:0');

    bus.publishAnswerChange({
      kind: 'single-choice', questionRef: 'question-ref', optionRef: 'option-ref-a',
    });

    expect(bridge.session?.answers.instances['root']['question'].selectedOptionIds).toEqual([]);
    expect(bridge.session?.answers.instances['loop:section:0']['question'].selectedOptionIds).toEqual(['option-a']);
  });
  it('dispatches DynamicAnswer and SKU values as canonical set-value commands', () => {
    const bus = new QuestionRuntimeEventBus();
    const bridge = new RendererRuntimeSessionBridge(bus);
    bridge.start(definition, {
      answerState: createInitialAnswerState(definition),
      loopRuntime: createSurveyLoopRuntime(definition),
    }, createProjector());

    const dynamicAnswer = {
      identificationCode: 123,
      answerTitle: 'Selected record',
      jsonValuesDictionary: { City: 'Isfahan' },
    };
    bus.publishAnswerChange({
      kind: 'question-value', questionRef: 'question-ref', value: dynamicAnswer,
    });
    expect(bridge.session?.answers.instances['root']['question'].value).toEqual(dynamicAnswer);

    const skus = [{
      identificationCode: 123, answerTitle: 'Selected SKU', quantity: 2, total: 4, history: [2],
    }];
    bus.publishAnswerChange({
      kind: 'question-value', questionRef: 'question-ref', value: skus,
    });
    expect(bridge.session?.answers.instances['root']['question'].value).toEqual(skus);
  });

  it('rejects unresolved renderer references without mutating canonical answers', () => {
    const bus = new QuestionRuntimeEventBus();
    const diagnostic = vi.fn();
    const bridge = new RendererRuntimeSessionBridge(bus, undefined, diagnostic);
    bridge.start(definition, {
      answerState: createInitialAnswerState(definition),
      loopRuntime: createSurveyLoopRuntime(definition),
    }, createProjector());
    const before = bridge.session;

    bus.publishAnswerChange({
      kind: 'single-choice', questionRef: 'missing-question', optionRef: 'option-ref-a',
    });

    expect(bridge.session).toBe(before);
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({
      source: 'renderer-adapter',
      code: 'RENDERER_QUESTION_REFERENCE_UNRESOLVED',
    }));
  });

  it('detaches events and releases the session on destroy', () => {
    const bus = new QuestionRuntimeEventBus();
    const bridge = new RendererRuntimeSessionBridge(bus);
    bridge.start(definition, {
      answerState: createInitialAnswerState(definition),
      loopRuntime: createSurveyLoopRuntime(definition),
    }, createProjector());

    bridge.destroy();
    bus.publishAnswerChange({
      kind: 'single-choice', questionRef: 'question-ref', optionRef: 'option-ref-a',
    });

    expect(bridge.session).toBeUndefined();
    expect(bridge.activeAnswerInstanceId).toBeUndefined();
  });
});
