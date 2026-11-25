import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyLoopRuntimeSnapshot } from '../flow/loop-runtime';
import {
  createSurveyRuntimeSession,
  dispatchSurveyRuntimeCommands,
  getCurrentSurveyRuntimePage,
  navigateSurveyRuntimeNext,
  navigateSurveyRuntimePrevious,
  type SurveyRuntimeSessionProjector,
  type SurveyRuntimeSessionResult,
  type SurveyRuntimeSessionSnapshot,
} from './runtime-session';
import type { AnswerCommand, AnswerStateSnapshot } from '../state/answer-state.types';

/**
 * UI-facing commands deliberately omit instanceId. The coordinator derives it
 * from the currently active flow page, preventing a stale renderer from writing
 * into a different SectionLoop iteration.
 */
export type ActiveSurveyAnswerCommand = AnswerCommand extends infer Command
  ? Command extends AnswerCommand
    ? Omit<Command, 'instanceId'>
    : never
  : never;

export type SurveyRuntimeSessionAcceptedHandler = (
  session: SurveyRuntimeSessionSnapshot,
) => void;

/**
 * Owns one synchronous survey session lifecycle.
 *
 * The coordinator is framework-agnostic. An application can pass
 * VoteService.synchronizeRuntimeSession as the accepted-session handler without
 * making the runtime depend on Angular or on legacy question models.
 */
export class SurveyRuntimeSessionCoordinator {
  private definition?: SurveyDefinition;
  private projector?: SurveyRuntimeSessionProjector;
  private currentSession?: SurveyRuntimeSessionSnapshot;

  constructor(
    private readonly onSessionAccepted?: SurveyRuntimeSessionAcceptedHandler,
  ) {}

  get session(): SurveyRuntimeSessionSnapshot | undefined {
    return this.currentSession;
  }

  get activeAnswerInstanceId(): string | undefined {
    const session = this.currentSession;
    return session
      ? getCurrentSurveyRuntimePage(session)?.answerInstanceId ?? 'root'
      : undefined;
  }

  /** Starts or replaces the active survey only when initial projection succeeds. */
  start(
    definition: SurveyDefinition,
    answers: AnswerStateSnapshot,
    loops: SurveyLoopRuntimeSnapshot,
    projector: SurveyRuntimeSessionProjector,
  ): SurveyRuntimeSessionResult {
    const result = createSurveyRuntimeSession(definition, answers, loops, projector);
    if (!result.applied) return result;

    this.definition = definition;
    this.projector = projector;
    this.commit(result);
    return result;
  }

  /** Applies a UI event batch to the currently active answer instance atomically. */
  dispatch(commands: readonly ActiveSurveyAnswerCommand[]): SurveyRuntimeSessionResult {
    const context = this.requireContext();
    const instanceId = this.activeAnswerInstanceId ?? 'root';
    const scopedCommands = commands.map((command) => ({
      ...command,
      instanceId,
    })) as AnswerCommand[];

    return this.commitTransition(dispatchSurveyRuntimeCommands(
      context.definition,
      context.session,
      scopedCommands,
      context.projector,
    ));
  }

  next(): SurveyRuntimeSessionResult {
    const context = this.requireContext();
    return this.commitTransition(navigateSurveyRuntimeNext(
      context.definition,
      context.session,
      context.projector,
    ));
  }

  previous(): SurveyRuntimeSessionResult {
    const context = this.requireContext();
    return this.commitTransition(navigateSurveyRuntimePrevious(
      context.definition,
      context.session,
      context.projector,
    ));
  }

  /** Drops references when the owning view/session is disposed. */
  reset(): void {
    this.currentSession = undefined;
    this.definition = undefined;
    this.projector = undefined;
  }

  private commitTransition(result: SurveyRuntimeSessionResult): SurveyRuntimeSessionResult {
    if (result.applied) this.commit(result);
    return result;
  }

  private commit(result: SurveyRuntimeSessionResult): void {
    this.currentSession = result.session;
    // The canonical session is committed before notifying adapters. A callback
    // can therefore safely read the latest snapshot or trigger a follow-up action.
    this.onSessionAccepted?.(result.session);
  }

  private requireContext(): {
    readonly definition: SurveyDefinition;
    readonly projector: SurveyRuntimeSessionProjector;
    readonly session: SurveyRuntimeSessionSnapshot;
  } {
    if (!this.definition || !this.projector || !this.currentSession) {
      throw new Error('SurveyRuntimeSessionCoordinator.start() must succeed before dispatch or navigation.');
    }
    return {
      definition: this.definition,
      projector: this.projector,
      session: this.currentSession,
    };
  }
}
