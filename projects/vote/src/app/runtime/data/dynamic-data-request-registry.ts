import { Observable, Subject, Subscription } from 'rxjs';

export type DynamicDataRequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface DynamicDataRequestState<T> {
  readonly instanceId: string;
  readonly questionId: string;
  readonly status: DynamicDataRequestStatus;
  /** Last successful result; retained during refresh and after a failed refresh. */
  readonly data?: T;
  readonly error?: unknown;
  readonly requestId: number;
}

export interface DynamicDataRequestStateChange<T> {
  readonly key: string;
  readonly state: DynamicDataRequestState<T>;
}

interface DynamicDataRequestEntry<T> {
  state: DynamicDataRequestState<T>;
  subscription?: Subscription;
}

/**
 * Owns cancellable, instance-scoped dynamic-data requests.
 *
 * Unsubscribing an Angular HttpClient observable aborts its HTTP request. The
 * monotonically increasing request ID is an additional stale-response guard
 * for observables whose underlying work cannot actually be cancelled.
 */
export class DynamicDataRequestRegistry<T> {
  private readonly entries = new Map<string, DynamicDataRequestEntry<T>>();
  private readonly changes = new Subject<DynamicDataRequestStateChange<T>>();
  private nextRequestId = 0;
  private activeInstanceId = 'root';
  private disposed = false;

  readonly stateChanges$ = this.changes.asObservable();

  get activeAnswerInstanceId(): string {
    return this.activeInstanceId;
  }

  getState(instanceId: string, questionId: string): DynamicDataRequestState<T> {
    const entry = this.entries.get(createKey(instanceId, questionId));
    return entry?.state ?? Object.freeze({
      instanceId,
      questionId,
      status: 'idle' as const,
      requestId: 0,
    });
  }

  /**
   * Activating another loop instance aborts all requests owned by the previous
   * instance. Successful cached results remain available under their own key.
   */
  activateInstance(instanceId: string): void {
    if (this.disposed || !instanceId || instanceId === this.activeInstanceId) return;
    this.activeInstanceId = instanceId;
    for (const [key, entry] of this.entries) {
      if (entry.state.instanceId !== instanceId) this.cancelEntry(key, entry);
    }
  }

  /**
   * Starts or replaces one question request. Requests for inactive answer
   * instances are rejected so an old renderer cannot initiate background work.
   */
  request(
    instanceId: string,
    questionId: string,
    createRequest: () => Observable<T>,
  ): boolean {
    if (this.disposed || instanceId !== this.activeInstanceId || !questionId) return false;

    const key = createKey(instanceId, questionId);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        state: Object.freeze({
          instanceId,
          questionId,
          status: 'idle',
          requestId: 0,
        }),
      };
      this.entries.set(key, entry);
    }

    entry.subscription?.unsubscribe();
    const requestId = ++this.nextRequestId;
    entry.state = Object.freeze({
      ...entry.state,
      status: 'loading',
      error: undefined,
      requestId,
    });
    this.emit(key, entry.state);

    let source: Observable<T>;
    try {
      source = createRequest();
    } catch (error) {
      this.failIfCurrent(key, entry, requestId, error);
      return true;
    }

    let emitted = false;
    const subscription = source.subscribe({
      next: (data) => {
        if (!this.isCurrent(key, entry!, requestId)) return;
        emitted = true;
        entry!.state = Object.freeze({
          ...entry!.state,
          status: 'success',
          data,
          error: undefined,
        });
        this.emit(key, entry!.state);
      },
      error: (error: unknown) => this.failIfCurrent(key, entry!, requestId, error),
      complete: () => {
        if (!this.isCurrent(key, entry!, requestId)) return;
        if (!emitted && entry!.state.status === 'loading') {
          entry!.state = Object.freeze({
            ...entry!.state,
            status: 'success',
            error: undefined,
          });
          this.emit(key, entry!.state);
        }
        entry!.subscription = undefined;
      },
    });

    if (this.isCurrent(key, entry, requestId) && !subscription.closed) {
      entry.subscription = subscription;
    }
    return true;
  }

  /** Cancels a question request but retains its last successful data. */
  cancel(instanceId: string, questionId: string): void {
    const key = createKey(instanceId, questionId);
    const entry = this.entries.get(key);
    if (entry) this.cancelEntry(key, entry);
  }

  /** Cancels all active requests and prevents any later request from starting. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [key, entry] of this.entries) this.cancelEntry(key, entry);
    this.changes.complete();
  }

  private cancelEntry(key: string, entry: DynamicDataRequestEntry<T>): void {
    entry.subscription?.unsubscribe();
    entry.subscription = undefined;
    if (entry.state.status !== 'loading') return;
    entry.state = Object.freeze({
      ...entry.state,
      status: 'idle',
      error: undefined,
      requestId: ++this.nextRequestId,
    });
    this.emit(key, entry.state);
  }

  private failIfCurrent(
    key: string,
    entry: DynamicDataRequestEntry<T>,
    requestId: number,
    error: unknown,
  ): void {
    if (!this.isCurrent(key, entry, requestId)) return;
    entry.subscription = undefined;
    entry.state = Object.freeze({
      ...entry.state,
      status: 'error',
      error,
    });
    this.emit(key, entry.state);
  }

  private isCurrent(
    key: string,
    entry: DynamicDataRequestEntry<T>,
    requestId: number,
  ): boolean {
    return !this.disposed &&
      this.entries.get(key) === entry &&
      entry.state.requestId === requestId &&
      entry.state.status === 'loading';
  }

  private emit(key: string, state: DynamicDataRequestState<T>): void {
    this.changes.next(Object.freeze({ key, state }));
  }
}

function createKey(instanceId: string, questionId: string): string {
  return JSON.stringify([instanceId, questionId]);
}
