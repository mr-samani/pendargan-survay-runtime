import { ExpressionTargetsEnum, FormExpressionTypeEnum } from '@service-proxies/models';
import type { SurveyDefinition, SurveySectionDefinition } from '../definition/definition.types';
import { addAnswerInstance } from '../state/answer-state.reducer';
import type { AnswerStateSnapshot } from '../state/answer-state.types';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';

export type LoopIterationStatus = 'active' | 'completed';
export interface SurveyLoopIteration {
  readonly iterationIndex: number;
  readonly backendLoopNumber: number;
  readonly answerInstanceId: string;
  readonly status: LoopIterationStatus;
  readonly isFilled: boolean;
  readonly variables: Readonly<Record<string, string>>;
  readonly dynamicDataRecordId?: string | number;
}
export interface SurveyLoopSectionState {
  readonly sectionId: string;
  readonly iterations: readonly SurveyLoopIteration[];
  readonly currentIterationIndex: number;
  readonly isComplete: boolean;
  readonly maxIterations: number;
}
export interface SurveyLoopRuntimeSnapshot {
  readonly surveyId: string;
  readonly revision: number;
  readonly sections: Readonly<Record<string, SurveyLoopSectionState>>;
}
export interface SurveyLoopDiagnostic {
  readonly code: string;
  readonly severity: 'warning' | 'error';
  readonly path: string;
  readonly message: string;
}
export interface SurveyLoopRuntimeResult {
  readonly runtime: SurveyLoopRuntimeSnapshot;
  readonly answerState: AnswerStateSnapshot;
  readonly applied: boolean;
  readonly createdInstanceId?: string;
  readonly diagnostics: readonly SurveyLoopDiagnostic[];
}

export function createSurveyLoopRuntime(definition: SurveyDefinition, maxIterations = 100): SurveyLoopRuntimeSnapshot {
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) {
    throw new RangeError('maxIterations must be an integer between 1 and 1000.');
  }
  const sections: Record<string, SurveyLoopSectionState> = {};
  for (const section of definition.sections) {
    if (!isLoopSection(definition, section)) continue;
    sections[section.id] = {
      sectionId: section.id,
      iterations: [{
        iterationIndex: 0, backendLoopNumber: 1, answerInstanceId: 'root',
        status: 'active', isFilled: false, variables: {},
      }],
      currentIterationIndex: 0,
      isComplete: false,
      maxIterations,
    };
  }
  return freezeRuntime({ surveyId: definition.id, revision: 0, sections });
}

/** Resolves the active SectionLoop result for a section from one formula evaluation. */
export function resolveSurveyLoopDecision(
  definition: SurveyDefinition,
  evaluation: SurveyFullEvaluationResult,
  sectionId: string,
): boolean | null {
  if (evaluation.surveyId !== definition.id) return null;
  const section = definition.sections.find((item) => item.id === sectionId);
  if (!section) return null;
  const matching = definition.expressions.filter((expression) =>
    expression.isActive &&
    expression.formExpressionType === FormExpressionTypeEnum.InsideForm &&
    expression.targetType === ExpressionTargetsEnum.SectionLoop &&
    (expression.targetKey === section.uniqueIdPerForm ||
      expression.targetKey === section.id ||
      expression.targetKey === section.sourceId));
  if (!matching.length) return null;

  // The legacy client applies SectionLoop results sequentially; the last matching
  // expression writes the section's hasLoop flag. Preserve that source order.
  const last = matching[matching.length - 1];
  const action = evaluation.proposedActions.find((item) => item.expressionId === last.id);
  return action ? action.conditionMet : null;
}

/** Convenience transition that reads the SectionLoop proposal from evaluator output. */
export function advanceSurveyLoopFromEvaluation(
  definition: SurveyDefinition,
  runtime: SurveyLoopRuntimeSnapshot,
  answerState: AnswerStateSnapshot,
  sectionId: string,
  evaluation: SurveyFullEvaluationResult,
): SurveyLoopRuntimeResult {
  if (evaluation.surveyId !== definition.id) {
    return failure(runtime, answerState, 'LOOP_EVALUATION_SURVEY_MISMATCH', sectionId,
      'Formula evaluation belongs to a different survey definition.');
  }
  return advanceSurveyLoop(
    definition, runtime, answerState, sectionId,
    resolveSurveyLoopDecision(definition, evaluation, sectionId),
  );
}

export function advanceSurveyLoop(
  definition: SurveyDefinition,
  runtime: SurveyLoopRuntimeSnapshot,
  answerState: AnswerStateSnapshot,
  sectionId: string,
  shouldRepeat: boolean | null,
): SurveyLoopRuntimeResult {
  if (runtime.surveyId !== definition.id || answerState.surveyId !== definition.id) {
    return failure(runtime, answerState, 'LOOP_SURVEY_MISMATCH', sectionId,
      'Definition, loop runtime, and answer state must belong to the same survey.');
  }
  const section = definition.sections.find((item) => item.id === sectionId);
  const current = runtime.sections[sectionId];
  if (!section || !isLoopSection(definition, section) || !current) {
    return failure(runtime, answerState, 'LOOP_SECTION_NOT_CONFIGURED', sectionId,
      'The requested section has no configured loop runtime.');
  }
  if (current.isComplete) {
    return failure(runtime, answerState, 'LOOP_ALREADY_COMPLETED', sectionId,
      'The loop section has already been completed.');
  }
  if (shouldRepeat === null) {
    return failure(runtime, answerState, 'LOOP_DECISION_UNKNOWN', sectionId,
      'The SectionLoop expression result is unknown; the loop cannot advance.');
  }
  const activeIndex = current.iterations.findIndex((item) =>
    item.iterationIndex === current.currentIterationIndex);
  const active = current.iterations[activeIndex];
  if (!active || active.status !== 'active') {
    return failure(runtime, answerState, 'LOOP_ACTIVE_ITERATION_MISSING', sectionId,
      'The current loop iteration is not active. Activate the intended iteration before advancing.');
  }
  if (!shouldRepeat) {
    const iterations = current.iterations.map((item, index) => index === activeIndex
      ? Object.freeze({ ...item, status: 'completed' as const, isFilled: true })
      : item);
    return success(replaceSection(runtime, {
      ...current, iterations, isComplete: true,
    }), answerState, true);
  }

  const nextIndex = current.currentIterationIndex + 1;
  const existingNext = current.iterations.find((item) => item.iterationIndex === nextIndex);
  if (existingNext) {
    const iterations = current.iterations.map((item) => Object.freeze({
      ...item,
      status: item.iterationIndex === nextIndex ? 'active' as const : 'completed' as const,
      isFilled: item.iterationIndex === current.currentIterationIndex ? true : item.isFilled,
    }));
    return success(replaceSection(runtime, {
      ...current, iterations, currentIterationIndex: nextIndex, isComplete: false,
    }), answerState, true, existingNext.answerInstanceId);
  }
  if (current.iterations.length >= current.maxIterations) {
    return failure(runtime, answerState, 'LOOP_MAX_ITERATIONS_REACHED', sectionId,
      'The loop reached its configured maximum of ' + current.maxIterations + ' iterations.');
  }

  const instanceId = createLoopAnswerInstanceId(sectionId, nextIndex);
  const questionIds = definition.questions
    .filter((question) => question.formSectionUniqueId === section.uniqueIdPerForm ||
      question.formSectionUniqueId === section.sourceId || question.formSectionUniqueId === section.id)
    .map((question) => question.id);
  const answerResult = addAnswerInstance(answerState, definition, instanceId, questionIds);
  if (!answerResult.applied) {
    return failureWithDiagnostics(runtime, answerState, answerResult.diagnostics.map((item) => ({
      code: item.code, severity: item.severity, path: item.path, message: item.message,
    })));
  }

  const iterations = current.iterations.map((item) => Object.freeze({
    ...item,
    status: 'completed' as const,
    isFilled: item.iterationIndex === current.currentIterationIndex ? true : item.isFilled,
  }));
  const nextIteration: SurveyLoopIteration = {
    iterationIndex: nextIndex,
    backendLoopNumber: nextIndex + 1,
    answerInstanceId: instanceId,
    status: 'active',
    isFilled: false,
    variables: {},
  };
  return success(replaceSection(runtime, {
    ...current, iterations: [...iterations, nextIteration],
    currentIterationIndex: nextIndex, isComplete: false,
  }), answerResult.state, true, instanceId);
}

/** Re-enters a previously created iteration without resetting its saved answers. */
export function activateSurveyLoopIteration(
  runtime: SurveyLoopRuntimeSnapshot,
  sectionId: string,
  iterationIndex: number,
): SurveyLoopRuntimeSnapshot {
  const section = runtime.sections[sectionId];
  if (!section) throw new Error('Loop section runtime does not exist: ' + sectionId);
  if (!section.iterations.some((item) => item.iterationIndex === iterationIndex)) {
    throw new Error('Loop iteration does not exist: ' + sectionId + '#' + iterationIndex);
  }
  const iterations = section.iterations.map((item) => Object.freeze({
    ...item,
    status: item.iterationIndex === iterationIndex ? 'active' as const : 'completed' as const,
  }));
  return replaceSection(runtime, {
    ...section, iterations, currentIterationIndex: iterationIndex, isComplete: false,
  });
}


/** Sets the persisted filled flag without changing the active iteration cursor. */
export function setSurveyLoopIterationFilled(
  runtime: SurveyLoopRuntimeSnapshot,
  sectionId: string,
  iterationIndex: number,
  isFilled: boolean,
): SurveyLoopRuntimeSnapshot {
  const section = runtime.sections[sectionId];
  if (!section) throw new Error('Loop section runtime does not exist: ' + sectionId);
  const index = section.iterations.findIndex((item) => item.iterationIndex === iterationIndex);
  if (index < 0) throw new Error('Loop iteration does not exist: ' + sectionId + '#' + iterationIndex);
  const iterations = [...section.iterations];
  iterations[index] = Object.freeze({ ...iterations[index], isFilled });
  return replaceSection(runtime, { ...section, iterations });
}

export function setSurveyLoopIterationVariables(
  runtime: SurveyLoopRuntimeSnapshot, sectionId: string, iterationIndex: number,
  variables: Readonly<Record<string, string>>,
): SurveyLoopRuntimeSnapshot {
  const section = runtime.sections[sectionId];
  if (!section) throw new Error('Loop section runtime does not exist: ' + sectionId);
  const index = section.iterations.findIndex((item) => item.iterationIndex === iterationIndex);
  if (index < 0) throw new Error('Loop iteration does not exist: ' + sectionId + '#' + iterationIndex);
  const iterations = [...section.iterations];
  iterations[index] = Object.freeze({ ...iterations[index], variables: Object.freeze({ ...variables }) });
  return replaceSection(runtime, { ...section, iterations });
}

export function setSurveyLoopIterationRecordId(
  runtime: SurveyLoopRuntimeSnapshot, sectionId: string, iterationIndex: number,
  dynamicDataRecordId: string | number,
): SurveyLoopRuntimeSnapshot {
  const section = runtime.sections[sectionId];
  if (!section) throw new Error('Loop section runtime does not exist: ' + sectionId);
  const index = section.iterations.findIndex((item) => item.iterationIndex === iterationIndex);
  if (index < 0) throw new Error('Loop iteration does not exist: ' + sectionId + '#' + iterationIndex);
  const iterations = [...section.iterations];
  iterations[index] = Object.freeze({ ...iterations[index], dynamicDataRecordId });
  return replaceSection(runtime, { ...section, iterations });
}

export function getSurveyLoopIteration(
  runtime: SurveyLoopRuntimeSnapshot, sectionId: string, iterationIndex: number,
): SurveyLoopIteration | undefined {
  return runtime.sections[sectionId]?.iterations.find((item) => item.iterationIndex === iterationIndex);
}

export function isLoopSection(definition: SurveyDefinition, section: SurveySectionDefinition): boolean {
  return definition.expressions.some((expression) =>
    expression.isActive &&
    expression.formExpressionType === FormExpressionTypeEnum.InsideForm &&
    expression.targetType === ExpressionTargetsEnum.SectionLoop &&
    (expression.targetKey === section.uniqueIdPerForm ||
      expression.targetKey === section.id || expression.targetKey === section.sourceId));
}

export function createLoopAnswerInstanceId(sectionId: string, iterationIndex: number): string {
  return 'loop:' + encodeURIComponent(sectionId) + ':' + iterationIndex;
}

function replaceSection(runtime: SurveyLoopRuntimeSnapshot, section: SurveyLoopSectionState): SurveyLoopRuntimeSnapshot {
  return freezeRuntime({
    surveyId: runtime.surveyId, revision: runtime.revision + 1,
    sections: { ...runtime.sections, [section.sectionId]: section },
  });
}
function success(
  runtime: SurveyLoopRuntimeSnapshot, answerState: AnswerStateSnapshot, applied: boolean,
  createdInstanceId?: string,
): SurveyLoopRuntimeResult {
  return Object.freeze({ runtime, answerState, applied, createdInstanceId, diagnostics: Object.freeze([]) });
}
function failure(
  runtime: SurveyLoopRuntimeSnapshot, answerState: AnswerStateSnapshot,
  code: string, path: string, message: string,
): SurveyLoopRuntimeResult {
  return failureWithDiagnostics(runtime, answerState, [{ code, severity: 'error', path, message }]);
}
function failureWithDiagnostics(
  runtime: SurveyLoopRuntimeSnapshot, answerState: AnswerStateSnapshot,
  diagnostics: readonly SurveyLoopDiagnostic[],
): SurveyLoopRuntimeResult {
  return Object.freeze({ runtime, answerState, applied: false, diagnostics: Object.freeze([...diagnostics]) });
}
function freezeRuntime(runtime: SurveyLoopRuntimeSnapshot): SurveyLoopRuntimeSnapshot {
  for (const section of Object.values(runtime.sections)) {
    for (const iteration of section.iterations) {
      Object.freeze(iteration.variables);
      Object.freeze(iteration);
    }
    Object.freeze(section.iterations);
    Object.freeze(section);
  }
  Object.freeze(runtime.sections);
  return Object.freeze(runtime);
}
