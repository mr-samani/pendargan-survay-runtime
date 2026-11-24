import type { SurveyDependencyGraph } from '../definition/dependency-graph';
import type { SurveyDefinition, DefinitionDiagnostic } from '../definition/definition.types';
import type { SurveyExpressionCompilation } from '../definition/expression.compiler';
import type { SurveyFullEvaluationResult } from '../definition/full-evaluator';
import { applySurveyActionTransaction, type ActionConflictPolicy } from '../actions/action-transaction';
import { resolveSurveyVisibility } from '../visibility/visibility-engine';
import { validateSurveyAnswers, type SurveyValidationOptions } from '../validation/validation-engine';
import { buildSurveyFlow, type SurveyFlowMode } from '../flow/flow-engine';
import type { SurveyLoopRuntimeSnapshot } from '../flow/loop-runtime';
import type { AnswerStateSnapshot } from '../state/answer-state.types';
import type { SurveyRuntimeSessionProjection, SurveyRuntimeSessionProjector } from './runtime-session';

export interface SurveyFormulaEvaluationContext {
  readonly definition: SurveyDefinition;
  readonly graph: SurveyDependencyGraph;
  readonly expressions: SurveyExpressionCompilation;
  readonly answers: AnswerStateSnapshot;
  readonly loops: SurveyLoopRuntimeSnapshot;
  readonly instanceId: string;
  readonly loopVariables: Readonly<Record<string, string>>;
}
export type SurveyFormulaEvaluator = (context: SurveyFormulaEvaluationContext) => SurveyFullEvaluationResult;

export interface ConcreteSurveyRuntimeProjectorOptions {
  readonly evaluate: SurveyFormulaEvaluator;
  readonly mode?: SurveyFlowMode;
  readonly maxActionPasses?: number;
  readonly conflictPolicy?: ActionConflictPolicy;
  readonly validation?: SurveyValidationOptions;
}
export interface ConcreteSurveyRuntimeProjection extends SurveyRuntimeSessionProjection {
  readonly answerState: AnswerStateSnapshot;
  readonly diagnostics: readonly DefinitionDiagnostic[];
  readonly isStable: boolean;
}

/**
 * Coordinates formula evaluation and pure runtime projections.
 * The formula evaluator is injected so the application controls parser scope creation;
 * action reconciliation and bounded fixed-point iteration remain owned here.
 */
export class ConcreteSurveyRuntimeProjector implements SurveyRuntimeSessionProjector {
  private readonly maxActionPasses: number;
  private readonly mode: SurveyFlowMode;

  constructor(
    private readonly graph: SurveyDependencyGraph,
    private readonly expressions: SurveyExpressionCompilation,
    private readonly options: ConcreteSurveyRuntimeProjectorOptions,
  ) {
    this.maxActionPasses = options.maxActionPasses ?? 8;
    this.mode = options.mode ?? 'section';
    if (!Number.isInteger(this.maxActionPasses) || this.maxActionPasses < 1 || this.maxActionPasses > 64) {
      throw new RangeError('maxActionPasses must be an integer between 1 and 64.');
    }
  }

  project(
    definition: SurveyDefinition,
    initialAnswers: AnswerStateSnapshot,
    loops: SurveyLoopRuntimeSnapshot,
    activeInstanceId: string,
  ): ConcreteSurveyRuntimeProjection {
    if (this.graph.surveyId !== definition.id || this.expressions.surveyId !== definition.id ||
        initialAnswers.surveyId !== definition.id || loops.surveyId !== definition.id) {
      return this.failure(definition, initialAnswers, activeInstanceId, 'PROJECTOR_SURVEY_MISMATCH',
        'Definition, graph, expression compilation, answers, and loops must belong to the same survey.');
    }
    if (!initialAnswers.instances[activeInstanceId]) {
      return this.failure(definition, initialAnswers, activeInstanceId, 'PROJECTOR_INSTANCE_UNKNOWN',
        'The active answer instance does not exist.');
    }
    if (!this.graph.isValid || !this.expressions.isValid) {
      return this.failure(definition, initialAnswers, activeInstanceId, 'PROJECTOR_DEFINITION_INVALID',
        'The dependency graph or expression compilation contains errors.');
    }

    let answers = initialAnswers;
    const seenStates = new Set<string>();
    for (let pass = 0; pass < this.maxActionPasses; pass++) {
      const signature = answerStateSignature(answers, activeInstanceId);
      if (seenStates.has(signature)) {
        return this.failure(definition, answers, activeInstanceId, 'ACTION_RECALCULATION_CYCLE',
          'Answer-changing actions returned to a previously observed answer state.');
      }
      seenStates.add(signature);

      const activeLoop = findActiveLoop(loops, activeInstanceId);
      const evaluation = this.options.evaluate({
        definition, graph: this.graph, expressions: this.expressions, answers, loops,
        instanceId: activeInstanceId,
        loopVariables: activeLoop?.variables ?? Object.freeze({}),
      });
      if (evaluation.surveyId !== definition.id) {
        return this.failure(definition, answers, activeInstanceId, 'PROJECTOR_EVALUATION_SURVEY_MISMATCH',
          'The formula evaluator returned a result for a different survey.');
      }

      const transaction = applySurveyActionTransaction(
        definition, answers, activeInstanceId, evaluation.proposedActions,
        { conflictPolicy: this.options.conflictPolicy ?? 'reject' },
      );
      if (!transaction.answerResult.applied) {
        return this.failureWithDiagnostics(definition, answers, activeInstanceId,
          transaction.resolution.diagnostics.map((item) => ({
            code: item.code, severity: item.severity, path: item.path, message: item.message,
          })));
      }
      if (transaction.answerResult.changedAnswers.length) {
        answers = transaction.answerResult.state;
        continue;
      }

      const visibility = resolveSurveyVisibility(definition, this.expressions, evaluation);
      const validation = validateSurveyAnswers(
        definition, answers, visibility, activeInstanceId, this.options.validation,
      );
      const flow = buildSurveyFlow(definition, visibility, { mode: this.mode, loopRuntime: loops });
      const diagnostics: DefinitionDiagnostic[] = [
        ...evaluation.diagnostics, ...visibility.diagnostics,
        ...flow.diagnostics.map((item) => ({
          code: item.code, severity: item.severity, path: item.path, message: item.message,
        })),
      ];
      return Object.freeze({
        surveyId: definition.id, answerState: answers, evaluation, visibility, validation, flow,
        diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze({ ...item }))),
        isStable: true,
      });
    }
    return this.failure(definition, answers, activeInstanceId, 'ACTION_RECALCULATION_LIMIT',
      'Answer-changing actions did not reach a stable state within ' + this.maxActionPasses + ' passes.');
  }

  private failure(
    definition: SurveyDefinition, answers: AnswerStateSnapshot, instanceId: string, code: string, message: string,
  ): ConcreteSurveyRuntimeProjection {
    return this.failureWithDiagnostics(definition, answers, instanceId, [{
      code, severity: 'error', path: instanceId, message,
    }]);
  }

  private failureWithDiagnostics(
    definition: SurveyDefinition, answers: AnswerStateSnapshot, instanceId: string,
    diagnostics: readonly DefinitionDiagnostic[],
  ): ConcreteSurveyRuntimeProjection {
    const evaluation: SurveyFullEvaluationResult = Object.freeze({
      surveyId: definition.id, formulaResults: Object.freeze([]), globalVariableValues: Object.freeze([]),
      proposedActions: Object.freeze([]), diagnostics: Object.freeze([...diagnostics]), isValid: false,
    });
    const visibility = resolveSurveyVisibility(definition, this.expressions, evaluation);
    const validation = validateSurveyAnswers(definition, answers, visibility, instanceId);
    const flow = buildSurveyFlow(definition, visibility, { mode: this.mode });
    return Object.freeze({
      surveyId: definition.id, answerState: answers, evaluation, visibility, validation, flow,
      diagnostics: Object.freeze(diagnostics.map((item) => Object.freeze({ ...item }))),
      isStable: false,
    });
  }
}

function findActiveLoop(
  loops: SurveyLoopRuntimeSnapshot, instanceId: string,
): { readonly variables: Readonly<Record<string, string>> } | undefined {
  for (const section of Object.values(loops.sections)) {
    const iteration = section.iterations.find((item) =>
      item.answerInstanceId === instanceId && item.iterationIndex === section.currentIterationIndex);
    if (iteration) return iteration;
  }
  return undefined;
}
function answerStateSignature(state: AnswerStateSnapshot, instanceId: string): string {
  const instance = state.instances[instanceId] ?? {};
  return JSON.stringify(Object.keys(instance).sort().map((questionId) => {
    const answer = instance[questionId];
    return [questionId, answer.value, [...answer.selectedOptionIds]];
  }));
}
