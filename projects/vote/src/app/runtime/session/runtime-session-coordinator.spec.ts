import { describe, expect, it, vi } from 'vitest';
import type { SurveyDefinition } from '../definition/definition.types';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import type { SurveyRuntimeSessionProjector, SurveyRuntimeSessionProjection } from './runtime-session';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import { SurveyRuntimeSessionCoordinator } from './runtime-session-coordinator';

const definition: SurveyDefinition = {
  id: 'coordinator-survey',
  sections: [{ id: 'section', source: {}, uniqueIdPerForm: 'section-backend' }],
  questions: [{
    id: 'question', source: {}, sourceId: 'question-backend',
    formSectionUniqueId: 'section', isActive: true, isRequired: false,
    options: [], settings: null,
  }],
  expressions: [],
  globalVariables: [],
};

function createProjector(valid: boolean): SurveyRuntimeSessionProjector {
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
          { id: 'page-1', kind: 'section', sectionId: 'section', questionIds: ['question'], answerInstanceId: 'root' },
          { id: 'page-2', kind: 'section', sectionId: 'section-2', questionIds: [], answerInstanceId: 'root' },
        ],
        visibleQuestionIds: ['question'], visibleSectionIds: ['section'],
        unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
      },
      validation: {
        surveyId: definition.id, instanceId, answerRevision: answers.revision,
        questions: [{ questionId: 'question', status: valid ? 'valid' : 'invalid', issues: [] }],
        issues: [], isValid: valid,
      },
    }),
  };
}

describe('SurveyRuntimeSessionCoordinator', () => {
  it('scopes UI commands to the active answer instance and notifies only after accepted transitions', () => {
    const accepted: string[] = [];
    const coordinator = new SurveyRuntimeSessionCoordinator((session) => {
      accepted.push(session.revision + ':' + session.currentPageId);
    });
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);

    const started = coordinator.start(definition, answers, loops, createProjector(true));
    expect(started.applied).toBe(true);
    expect(coordinator.activeAnswerInstanceId).toBe('root');
    expect(accepted).toHaveLength(1);

    const changed = coordinator.dispatch([{
      type: 'set-value', questionId: 'question', value: 'hello',
    }]);
    expect(changed.applied).toBe(true);
    expect(changed.session.answers.instances['root']['question'].value).toBe('hello');
    expect(accepted).toHaveLength(2);

    const noOp = coordinator.dispatch([{
      type: 'set-value', questionId: 'question', value: 'hello',
    }]);
    expect(noOp.session).toBe(changed.session);
    expect(accepted).toHaveLength(2);
  });

  it('does not notify the UI bridge when navigation is rejected by validation', () => {
    const onAccepted = vi.fn();
    const coordinator = new SurveyRuntimeSessionCoordinator(onAccepted);
    coordinator.start(
      definition,
      createInitialAnswerState(definition),
      createSurveyLoopRuntime(definition),
      createProjector(false),
    );

    const before = coordinator.session;
    const result = coordinator.next();

    expect(result.applied).toBe(false);
    expect(result.diagnostics[0].code).toBe('SESSION_CURRENT_PAGE_INVALID');
    expect(coordinator.session).toBe(before);
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  it('requires a successfully started session before accepting UI events', () => {
    const coordinator = new SurveyRuntimeSessionCoordinator();
    expect(() => coordinator.dispatch([{
      type: 'clear', questionId: 'question',
    }])).toThrow('SurveyRuntimeSessionCoordinator.start()');
  });

  it('keeps a failed replacement start from discarding the current session', () => {
    const coordinator = new SurveyRuntimeSessionCoordinator();
    const first = coordinator.start(
      definition,
      createInitialAnswerState(definition),
      createSurveyLoopRuntime(definition),
      createProjector(true),
    );
    const current = coordinator.session;

    const mismatchedDefinition = { ...definition, id: 'other-survey' };
    const failed = coordinator.start(
      mismatchedDefinition,
      createInitialAnswerState(definition),
      createSurveyLoopRuntime(mismatchedDefinition),
      createProjector(true),
    );

    expect(first.applied).toBe(true);
    expect(failed.applied).toBe(false);
    expect(coordinator.session).toBe(current);
  });
});
