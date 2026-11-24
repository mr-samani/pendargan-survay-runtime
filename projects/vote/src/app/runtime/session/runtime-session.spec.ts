import { describe, expect, it } from 'vitest';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import { createInitialAnswerState } from '../state/answer-state.reducer';
import { createSurveyLoopRuntime } from '../flow/loop-runtime';
import type { SurveyFlowSnapshot } from '../flow/flow-engine';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';
import type { SurveyValidationResult } from '../validation/validation-engine';
import {
  createSurveyRuntimeSession,
  dispatchSurveyRuntimeCommands,
  navigateSurveyRuntimeNext,
  navigateSurveyRuntimePrevious,
  type SurveyRuntimeSessionProjector,
  type SurveyRuntimeSessionProjection,
} from './runtime-session';

const definition: SurveyDefinition = {
  id: 'survey',
  sections: [{ id: 'section', source: {}, uniqueIdPerForm: 'section-backend' }],
  questions: [{
    id: 'q', source: {}, sourceId: 'q-backend', formSectionUniqueId: 'section',
    isActive: true, isRequired: false, options: [], settings: null,
  }],
  expressions: [],
  globalVariables: [],
};

function projection(answers: ReturnType<typeof createInitialAnswerState>, valid: boolean | null = true, validationRevision = answers.revision): SurveyRuntimeSessionProjection {
  const evaluation: SurveyFullEvaluationResult = {
    surveyId: 'survey', formulaResults: [], globalVariableValues: [], proposedActions: [],
    diagnostics: [], isValid: true,
  };
  const visibility: SurveyVisibilityResult = {
    surveyId: 'survey',
    questions: [{ questionId: 'q', isVisible: true, options: [] }],
    sections: [{ sectionId: 'section', isVisible: true, questionIds: ['q'] }],
    unhandledActions: [], diagnostics: [], isValid: true,
  };
  const flow: SurveyFlowSnapshot = {
    surveyId: 'survey', mode: 'section',
    pages: [
      { id: 'page-1', kind: 'section', sectionId: 'section', questionIds: ['q'], answerInstanceId: 'root' },
      { id: 'page-2', kind: 'section', sectionId: 'section-2', questionIds: [], answerInstanceId: 'root' },
    ],
    visibleQuestionIds: ['q'], visibleSectionIds: ['section'],
    unresolvedQuestionIds: [], unresolvedSectionIds: [], diagnostics: [], isReady: true, isValid: true,
  };
  const validation: SurveyValidationResult = {
    surveyId: 'survey', instanceId: 'root', answerRevision: validationRevision,
    questions: [{ questionId: 'q', status: valid === true ? 'valid' : valid === false ? 'invalid' : 'unknown', issues: [] }],
    issues: [], isValid: valid,
  };
  return { answerState: answers, evaluation, visibility, flow, validation };
}

function projector(valid: boolean | null = true): SurveyRuntimeSessionProjector {
  return { project: (_definition, answers) => projection(answers, valid) };
}

describe('survey runtime session', () => {
  it('creates a session from matching immutable snapshots', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const result = createSurveyRuntimeSession(definition, answers, loops, projector());
    expect(result.applied).toBe(true);
    expect(result.session.currentPageId).toBe('page-1');
  });

  it('rejects navigation when current-page validation is invalid or unknown', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const invalid = createSurveyRuntimeSession(definition, answers, loops, projector(false)).session;
    expect(navigateSurveyRuntimeNext(definition, invalid, projector()).diagnostics[0].code)
      .toBe('SESSION_CURRENT_PAGE_INVALID');

    const unknown = createSurveyRuntimeSession(definition, answers, loops, projector(null)).session;
    expect(navigateSurveyRuntimeNext(definition, unknown, projector()).diagnostics[0].code)
      .toBe('SESSION_CURRENT_PAGE_INVALID');
  });

  it('applies answer commands atomically and navigates in both directions', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const initial = createSurveyRuntimeSession(definition, answers, loops, projector()).session;
    const changed = dispatchSurveyRuntimeCommands(definition, initial, [{
      type: 'set-value', instanceId: 'root', questionId: 'q', value: 'answer',
    }], projector());
    expect(changed.applied).toBe(true);
    expect(changed.session.answers.revision).toBe(1);

    const next = navigateSurveyRuntimeNext(definition, changed.session, projector());
    expect(next.session.currentPageId).toBe('page-2');
    const previous = navigateSurveyRuntimePrevious(definition, next.session);
    expect(previous.session.currentPageId).toBe('page-1');
  });

  it('rejects a projector result whose validation revision is stale', () => {
    const answers = createInitialAnswerState(definition);
    const loops = createSurveyLoopRuntime(definition);
    const staleProjector: SurveyRuntimeSessionProjector = {
      project: () => projection(answers, true, answers.revision + 1),
    };
    const result = createSurveyRuntimeSession(definition, answers, loops, staleProjector);
    expect(result.applied).toBe(false);
    expect(result.diagnostics[0].code).toBe('SESSION_VALIDATION_STALE');
  });
});
