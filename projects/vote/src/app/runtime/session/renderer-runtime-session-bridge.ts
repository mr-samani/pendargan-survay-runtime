import type { Subscription } from 'rxjs';
import type { SurveyDefinition } from '../definition/definition.types';
import type { SurveyLoopRuntimeSnapshot } from '../flow/loop-runtime';
import type { AnswerStateSnapshot } from '../state/answer-state.types';
import type { SurveyRuntimeSessionProjector, SurveyRuntimeSessionResult, SurveyRuntimeSessionSnapshot } from './runtime-session';
import { SurveyRuntimeSessionCoordinator, type ActiveSurveyAnswerCommand } from './runtime-session-coordinator';
import { compileRendererAnswerChange } from './renderer-answer-command.adapter';
import type { QuestionRuntimeEventBus } from '../../questions/shared/question-runtime-event-bus';

export interface RestoredSurveyRuntimeState {
  readonly answerState: AnswerStateSnapshot;
  readonly loopRuntime: SurveyLoopRuntimeSnapshot;
}

export type RendererRuntimeDiagnostic =
  | { readonly source: 'renderer-adapter'; readonly code: string; readonly path: string; readonly message: string }
  | { readonly source: 'session'; readonly code: string; readonly path: string; readonly message: string };

/**
 * Owns the boundary between dynamically-created renderers and the canonical
 * immutable session. It must be started with restored snapshots before it
 * subscribes to renderer events; legacy vote.form remains a compatibility view.
 */
export class RendererRuntimeSessionBridge {
  private readonly coordinator: SurveyRuntimeSessionCoordinator;
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: QuestionRuntimeEventBus,
    onAccepted?: (session: SurveyRuntimeSessionSnapshot) => void,
    private readonly onDiagnostic?: (diagnostic: RendererRuntimeDiagnostic) => void,
  ) {
    this.coordinator = new SurveyRuntimeSessionCoordinator(onAccepted);
  }

  get session(): SurveyRuntimeSessionSnapshot | undefined {
    return this.coordinator.session;
  }

  get activeAnswerInstanceId(): string | undefined {
    return this.coordinator.activeAnswerInstanceId;
  }

  /** A failed start leaves the previous session and its event subscription intact. */
  start(
    definition: SurveyDefinition,
    restored: RestoredSurveyRuntimeState,
    projector: SurveyRuntimeSessionProjector,
  ): SurveyRuntimeSessionResult {
    const result = this.coordinator.start(
      definition, restored.answerState, restored.loopRuntime, projector,
    );
    if (!result.applied) {
      this.reportSessionDiagnostics(result);
      return result;
    }

    this.subscription?.unsubscribe();
    // Subscribe only after start has committed the restored canonical snapshot.
    this.subscription = this.eventBus.answerChanges$.subscribe((change) => {
      const instanceId = this.coordinator.activeAnswerInstanceId;
      if (!instanceId) return;

      const compiled = compileRendererAnswerChange(definition, instanceId, change);
      if (compiled.diagnostics.length) {
        for (const diagnostic of compiled.diagnostics) {
          this.onDiagnostic?.({ source: 'renderer-adapter', ...diagnostic });
        }
        return;
      }

      // The coordinator derives instanceId itself. Strip the adapter's copy so
      // the event cannot choose or retain a stale loop namespace.
      const commands: ActiveSurveyAnswerCommand[] = compiled.commands.map((command) => {
        const { instanceId: _ignored, ...activeCommand } = command;
        return activeCommand as ActiveSurveyAnswerCommand;
      });
      const dispatched = this.coordinator.dispatch(commands);
      if (!dispatched.applied) this.reportSessionDiagnostics(dispatched);
    });
    return result;
  }

  next(): SurveyRuntimeSessionResult {
    const result = this.coordinator.next();
    if (!result.applied) this.reportSessionDiagnostics(result);
    return result;
  }

  previous(): SurveyRuntimeSessionResult {
    const result = this.coordinator.previous();
    if (!result.applied) this.reportSessionDiagnostics(result);
    return result;
  }

  /** Dispatches a host-originated answer update through the same canonical transaction boundary. */
  dispatch(commands: readonly ActiveSurveyAnswerCommand[]): SurveyRuntimeSessionResult {
    const result = this.coordinator.dispatch(commands);
    if (!result.applied) this.reportSessionDiagnostics(result);
    return result;
  }

  /** Commits a host-owned answer update to the answer instance that created it. */
  dispatchToInstance(
    instanceId: string,
    commands: readonly ActiveSurveyAnswerCommand[],
  ): SurveyRuntimeSessionResult {
    const result = this.coordinator.dispatchToInstance(instanceId, commands);
    if (!result.applied) this.reportSessionDiagnostics(result);
    return result;
  }

  /** Detaches renderer events and releases the active session references. */
  destroy(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.coordinator.reset();
  }

  private reportSessionDiagnostics(result: SurveyRuntimeSessionResult): void {
    for (const diagnostic of result.diagnostics) {
      this.onDiagnostic?.({ source: 'session', ...diagnostic });
    }
  }
}
