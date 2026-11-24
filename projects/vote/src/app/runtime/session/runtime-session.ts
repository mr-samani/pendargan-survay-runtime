import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import { applyAnswerCommands } from '../state/answer-state.reducer';
import { initializeLegacyQuestionInitialValues } from './legacy-initial-values';
import type { AnswerCommand, AnswerStateSnapshot } from '../state/answer-state.types';
import type { SurveyFlowPage, SurveyFlowSnapshot } from '../flow/flow-engine';
import { getAdjacentSurveyFlowPage, getSurveyFlowNavigation } from '../flow/flow-engine';
import {
  advanceSurveyLoopFromEvaluation,
  isLoopSection,
  activateSurveyLoopIteration,
  type SurveyLoopRuntimeSnapshot,
} from '../flow/loop-runtime';
import type { SurveyVisibilityResult } from '../visibility/visibility-engine';
import type { SurveyValidationResult } from '../validation/validation-engine';

export interface SurveyRuntimeSessionProjection {
  /** Answer snapshot after the projector has reconciled all supported actions. */
  readonly answerState: AnswerStateSnapshot;
  readonly diagnostics?: readonly { readonly code: string; readonly severity: 'warning' | 'error'; readonly path: string; readonly message: string }[];
  readonly isStable?: boolean;
  readonly evaluation: SurveyFullEvaluationResult;
  readonly visibility: SurveyVisibilityResult;
  readonly flow: SurveyFlowSnapshot;
  readonly validation: SurveyValidationResult;
}

export interface SurveyRuntimeSessionProjector {
  /**
   * Rebuilds the derived runtime projection for the active answer instance.
   * The adapter is responsible for formula evaluation, action reconciliation,
   * visibility, validation, and flow construction; it must not mutate inputs.
   */
  project(
    definition: SurveyDefinition,
    answers: AnswerStateSnapshot,
    loops: SurveyLoopRuntimeSnapshot,
    activeInstanceId: string,
  ): SurveyRuntimeSessionProjection;
}

export interface SurveyRuntimeSessionSnapshot {
  readonly surveyId: string;
  readonly revision: number;
  readonly answers: AnswerStateSnapshot;
  readonly loops: SurveyLoopRuntimeSnapshot;
  readonly currentPageId?: string;
  readonly projection: SurveyRuntimeSessionProjection;
}

export interface SurveyRuntimeSessionDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface SurveyRuntimeSessionResult {
  readonly session: SurveyRuntimeSessionSnapshot;
  readonly applied: boolean;
  readonly diagnostics: readonly SurveyRuntimeSessionDiagnostic[];
}

/** Creates a session after validating that all initial snapshots belong together. */
export function createSurveyRuntimeSession(
  definition: SurveyDefinition,
  answers: AnswerStateSnapshot,
  loops: SurveyLoopRuntimeSnapshot,
  projector: SurveyRuntimeSessionProjector,
): SurveyRuntimeSessionResult {
  const mismatch = validateSnapshotOwnership(definition, answers, loops);
  if (mismatch) return rejectedSession(
    createEmptySession(definition.id, answers, loops), mismatch.code, mismatch.path, mismatch.message,
  );

  const initialized = initializeLegacyQuestionInitialValues(definition, answers, 'root');
  if (!initialized.applied) {
    const first = initialized.diagnostics[0];
    return rejectedSession(
      createEmptySession(definition.id, answers, loops),
      first?.code ?? 'SESSION_INITIAL_VALUE_INITIALIZATION_FAILED',
      first?.path ?? 'answers',
      first?.message ?? 'Legacy initial values could not be initialized.',
    );
  }

  const projection = projector.project(definition, initialized.state, loops, 'root');
  const invalid = validateProjection(definition.id, projection.answerState, projection);
  if (invalid) return rejectedSession(
    createEmptySession(definition.id, answers, loops), invalid.code, invalid.path, invalid.message,
  );

  return acceptedSession(Object.freeze({
    surveyId: definition.id,
    revision: 0,
    answers: projection.answerState,
    loops,
    currentPageId: projection.flow.pages[0]?.id,
    projection,
  }), true);
}

/** Applies one atomic input batch and refreshes all derived projections once. */
export function dispatchSurveyRuntimeCommands(
  definition: SurveyDefinition,
  session: SurveyRuntimeSessionSnapshot,
  commands: readonly AnswerCommand[],
  projector: SurveyRuntimeSessionProjector,
): SurveyRuntimeSessionResult {
  const ownership = validateSessionOwnership(definition, session);
  if (ownership) return rejectedSession(session, ownership.code, ownership.path, ownership.message);

  const instanceId = getCurrentPage(session)?.answerInstanceId ?? 'root';
  const applied = applyAnswerCommands(definition, session.answers, commands);
  if (!applied.applied) {
    return Object.freeze({
      session,
      applied: false,
      diagnostics: Object.freeze(applied.diagnostics.map((item) => Object.freeze({
        code: item.code, path: item.path, message: item.message,
      }))),
    });
  }
  if (!applied.changedAnswers.length) return acceptedSession(session, false);

  return refreshSession(definition, session, applied.state, session.loops, instanceId, projector);
}

/**
 * Moves to the next page only when every question on the current page is known
 * valid. For SectionLoop pages, it first resolves the loop transition from the
 * current formula evaluation and reprojects the newly active iteration.
 */
export function navigateSurveyRuntimeNext(
  definition: SurveyDefinition,
  session: SurveyRuntimeSessionSnapshot,
  projector: SurveyRuntimeSessionProjector,
): SurveyRuntimeSessionResult {
  const ownership = validateSessionOwnership(definition, session);
  if (ownership) return rejectedSession(session, ownership.code, ownership.path, ownership.message);

  const current = getCurrentPage(session);
  if (!current) return rejectedSession(
    session, 'SESSION_FLOW_EMPTY', 'flow.pages', 'The survey has no navigable page.',
  );
  if (!isCurrentPageValid(session.projection.validation, current)) {
    return rejectedSession(
      session, 'SESSION_CURRENT_PAGE_INVALID', current.id,
      'The current page has invalid or unresolved answers; navigation is blocked.',
    );
  }

  if (current.sectionId) {
    const section = definition.sections.find((item) => item.id === current.sectionId);
    if (section && isLoopSection(definition, section) && session.loops.sections[current.sectionId]) {
      const transition = advanceSurveyLoopFromEvaluation(
        definition, session.loops, session.answers, current.sectionId, session.projection.evaluation,
      );
      if (!transition.applied) {
        const first = transition.diagnostics[0];
        return rejectedSession(
          session, first?.code ?? 'SESSION_LOOP_TRANSITION_FAILED',
          first?.path ?? current.sectionId,
          first?.message ?? 'The loop transition could not be completed.',
        );
      }

      const activeInstanceId = transition.runtime.sections[current.sectionId].iterations[
        transition.runtime.sections[current.sectionId].currentIterationIndex
      ].answerInstanceId;
      const loopAnswers = transition.createdInstanceId
        ? initializeLegacyQuestionInitialValues(definition, transition.answerState, transition.createdInstanceId)
        : { state: transition.answerState, applied: true, changedAnswers: [], diagnostics: [] };
      if (!loopAnswers.applied) {
        const first = loopAnswers.diagnostics[0];
        return rejectedSession(
          session,
          first?.code ?? 'SESSION_LOOP_INITIAL_VALUE_FAILED',
          first?.path ?? activeInstanceId,
          first?.message ?? 'Initial values for the new loop iteration could not be initialized.',
        );
      }
      const projection = projector.project(
        definition, loopAnswers.state, transition.runtime, activeInstanceId,
      );
      const invalid = validateProjection(definition.id, projection.answerState, projection);
      if (invalid) return rejectedSession(session, invalid.code, invalid.path, invalid.message);

      const loopState = transition.runtime.sections[current.sectionId];
      const nextIterationPage = projection.flow.pages.find((page) =>
        page.sectionId === current.sectionId &&
        page.loopIterationIndex === loopState.currentIterationIndex);
      const nextPage = loopState.isComplete
        ? getAdjacentSurveyFlowPage(session.projection.flow, current.id, 'next')
        : nextIterationPage;
      if (!nextPage && !loopState.isComplete) {
        return rejectedSession(
          session, 'SESSION_LOOP_PAGE_MISSING', current.sectionId,
          'The new loop iteration has no corresponding flow page.',
        );
      }
      return acceptedSession(Object.freeze({
        surveyId: definition.id,
        revision: session.revision + 1,
        answers: projection.answerState,
        loops: transition.runtime,
        currentPageId: nextPage?.id,
        projection,
      }), true);
    }
  }

  const next = getAdjacentSurveyFlowPage(session.projection.flow, current.id, 'next');
  if (!next) return acceptedSession(session, false);
  return acceptedSession(Object.freeze({
    ...session,
    revision: session.revision + 1,
    currentPageId: next.id,
  }), true);
}

export function navigateSurveyRuntimePrevious(
  definition: SurveyDefinition,
  session: SurveyRuntimeSessionSnapshot,
  projector: SurveyRuntimeSessionProjector,
): SurveyRuntimeSessionResult {
  const ownership = validateSessionOwnership(definition, session);
  if (ownership) return rejectedSession(session, ownership.code, ownership.path, ownership.message);
  const current = getCurrentPage(session);
  if (!current) return acceptedSession(session, false);
  const previous = getAdjacentSurveyFlowPage(session.projection.flow, current.id, 'previous');
  if (!previous) return acceptedSession(session, false);

  const targetInstanceId = previous.answerInstanceId ?? 'root';
  let loops = session.loops;
  if (targetInstanceId !== (current.answerInstanceId ?? 'root') && previous.sectionId) {
    const loop = loops.sections[previous.sectionId];
    if (loop) {
      const iteration = loop.iterations.find((item) => item.answerInstanceId === targetInstanceId);
      if (!iteration) return rejectedSession(
        session, 'SESSION_PREVIOUS_LOOP_ITERATION_MISSING', previous.id,
        'The previous flow page refers to a loop iteration that does not exist.',
      );
      loops = activateSurveyLoopIteration(loops, previous.sectionId, iteration.iterationIndex);
    }
  }

  if (targetInstanceId !== (current.answerInstanceId ?? 'root') || loops !== session.loops) {
    const projection = projector.project(definition, session.answers, loops, targetInstanceId);
    const invalid = validateProjection(definition.id, projection.answerState, projection);
    if (invalid) return rejectedSession(session, invalid.code, invalid.path, invalid.message);
    return acceptedSession(Object.freeze({
      surveyId: definition.id,
      revision: session.revision + 1,
      answers: projection.answerState,
      loops,
      currentPageId: previous.id,
      projection,
    }), true);
  }

  return acceptedSession(Object.freeze({
    ...session,
    revision: session.revision + 1,
    currentPageId: previous.id,
  }), true);
}

export function getCurrentSurveyRuntimePage(
  session: SurveyRuntimeSessionSnapshot,
): SurveyFlowPage | undefined {
  return getCurrentPage(session);
}

function refreshSession(
  definition: SurveyDefinition,
  previous: SurveyRuntimeSessionSnapshot,
  answers: AnswerStateSnapshot,
  loops: SurveyLoopRuntimeSnapshot,
  activeInstanceId: string,
  projector: SurveyRuntimeSessionProjector,
): SurveyRuntimeSessionResult {
  const projection = projector.project(definition, answers, loops, activeInstanceId);
  const invalid = validateProjection(definition.id, projection.answerState, projection);
  if (invalid) return rejectedSession(previous, invalid.code, invalid.path, invalid.message);
  const currentStillExists = projection.flow.pages.some((page) => page.id === previous.currentPageId);
  return acceptedSession(Object.freeze({
    surveyId: definition.id,
    revision: previous.revision + 1,
    answers: projection.answerState,
    loops,
    currentPageId: currentStillExists ? previous.currentPageId : projection.flow.pages[0]?.id,
    projection,
  }), true);
}

function isCurrentPageValid(validation: SurveyValidationResult, page: SurveyFlowPage): boolean {
  if (validation.instanceId !== (page.answerInstanceId ?? 'root')) return false;
  const statuses = new Map(validation.questions.map((item) => [item.questionId, item.status]));
  return page.questionIds.every((id) => {
    const status = statuses.get(id);
    return status === 'valid' || status === 'skipped';
  });
}

function getCurrentPage(session: SurveyRuntimeSessionSnapshot): SurveyFlowPage | undefined {
  return session.projection.flow.pages.find((page) => page.id === session.currentPageId);
}

function validateSnapshotOwnership(
  definition: SurveyDefinition, answers: AnswerStateSnapshot, loops: SurveyLoopRuntimeSnapshot,
): SurveyRuntimeSessionDiagnostic | undefined {
  if (answers.surveyId !== definition.id || loops.surveyId !== definition.id) {
    return { code: 'SESSION_SURVEY_MISMATCH', path: 'surveyId',
      message: 'Definition, answer state, and loop runtime must belong to the same survey.' };
  }
  return undefined;
}

function validateSessionOwnership(
  definition: SurveyDefinition, session: SurveyRuntimeSessionSnapshot,
): SurveyRuntimeSessionDiagnostic | undefined {
  if (session.surveyId !== definition.id || session.answers.surveyId !== definition.id ||
      session.loops.surveyId !== definition.id) {
    return { code: 'SESSION_SURVEY_MISMATCH', path: 'surveyId',
      message: 'The session snapshots do not belong to the supplied survey definition.' };
  }
  if (session.projection.flow.surveyId !== definition.id ||
      session.projection.visibility.surveyId !== definition.id ||
      session.projection.evaluation.surveyId !== definition.id ||
      session.projection.validation.surveyId !== definition.id) {
    return { code: 'SESSION_PROJECTION_MISMATCH', path: 'projection',
      message: 'One or more derived projections belong to a different survey.' };
  }
  return undefined;
}

function validateProjection(
  surveyId: string, answers: AnswerStateSnapshot, projection: SurveyRuntimeSessionProjection,
): SurveyRuntimeSessionDiagnostic | undefined {
  if (projection.flow.surveyId !== surveyId || projection.visibility.surveyId !== surveyId ||
      projection.evaluation.surveyId !== surveyId || projection.validation.surveyId !== surveyId) {
    return { code: 'SESSION_PROJECTION_MISMATCH', path: 'projection',
      message: 'The projector returned data for a different survey.' };
  }
  if (projection.answerState.surveyId !== surveyId) {
    return { code: 'SESSION_PROJECTED_ANSWER_MISMATCH', path: 'projection.answerState.surveyId',
      message: 'The projector returned answer state for a different survey.' };
  }
  if (projection.isStable === false) {
    const issue = projection.diagnostics?.find((item) => item.severity === 'error');
    return { code: issue?.code ?? 'SESSION_PROJECTION_UNSTABLE', path: issue?.path ?? 'projection',
      message: issue?.message ?? 'The projector did not reach a stable answer/action state.' };
  }
  const projectionError = projection.diagnostics?.find((item) => item.severity === 'error');
  if (projectionError) return { code: projectionError.code, path: projectionError.path, message: projectionError.message };
  if (projection.validation.answerRevision !== answers.revision) {
    return { code: 'SESSION_VALIDATION_STALE', path: 'projection.validation.answerRevision',
      message: 'Validation must be calculated from the exact answer-state revision being committed.' };
  }
  return undefined;
}

function createEmptySession(
  surveyId: string, answers: AnswerStateSnapshot, loops: SurveyLoopRuntimeSnapshot,
): SurveyRuntimeSessionSnapshot {
  const emptyFlow: SurveyFlowSnapshot = Object.freeze({
    surveyId, mode: 'section', pages: Object.freeze([]), visibleQuestionIds: Object.freeze([]),
    visibleSectionIds: Object.freeze([]), unresolvedQuestionIds: Object.freeze([]),
    unresolvedSectionIds: Object.freeze([]), diagnostics: Object.freeze([]), isReady: false, isValid: false,
  });
  const emptyProjection = Object.freeze({
    answerState: answers,
    evaluation: Object.freeze({ surveyId, formulaResults: Object.freeze([]), globalVariableValues: Object.freeze([]),
      proposedActions: Object.freeze([]), diagnostics: Object.freeze([]), isValid: false }),
    visibility: Object.freeze({ surveyId, questions: Object.freeze([]), sections: Object.freeze([]),
      unhandledActions: Object.freeze([]), diagnostics: Object.freeze([]), isValid: false }),
    flow: emptyFlow,
    validation: Object.freeze({ surveyId, instanceId: 'root', answerRevision: answers.revision,
      questions: Object.freeze([]), issues: Object.freeze([]), isValid: null }),
  });
  return Object.freeze({ surveyId, revision: 0, answers, loops, projection: emptyProjection });
}

function acceptedSession(session: SurveyRuntimeSessionSnapshot, applied: boolean): SurveyRuntimeSessionResult {
  return Object.freeze({ session, applied, diagnostics: Object.freeze([]) });
}
function rejectedSession(
  session: SurveyRuntimeSessionSnapshot, code: string, path: string, message: string,
): SurveyRuntimeSessionResult {
  return Object.freeze({
    session, applied: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}
