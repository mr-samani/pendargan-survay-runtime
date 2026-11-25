import { Observable, Subject, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DynamicDataRequestRegistry } from './dynamic-data-request-registry';

describe('DynamicDataRequestRegistry', () => {
  it('keeps only the latest request result when a filter change replaces an in-flight request', () => {
    const registry = new DynamicDataRequestRegistry<readonly string[]>();
    const first = new Subject<readonly string[]>();
    const second = new Subject<readonly string[]>();
    const firstTeardown = vi.fn();

    registry.request('root', 'dynamic-question', () =>
      new Observable<readonly string[]>((subscriber) => {
        const subscription = first.subscribe(subscriber);
        return () => {
          firstTeardown();
          subscription.unsubscribe();
        };
      }),
    );
    registry.request('root', 'dynamic-question', () => second.asObservable());

    expect(firstTeardown).toHaveBeenCalledOnce();
    first.next(['stale']);
    second.next(['current']);

    expect(registry.getState('root', 'dynamic-question')).toMatchObject({
      status: 'success',
      data: ['current'],
    });
  });

  it('cancels requests from the previous loop instance and retains its successful cache', () => {
    const registry = new DynamicDataRequestRegistry<readonly string[]>();
    const pending = new Subject<readonly string[]>();
    const teardown = vi.fn();

    registry.request('loop:section:0', 'sku-question', () =>
      new Observable<readonly string[]>((subscriber) => {
        const subscription = pending.subscribe(subscriber);
        return () => {
          teardown();
          subscription.unsubscribe();
        };
      }),
    );
    registry.activateInstance('loop:section:1');

    expect(teardown).toHaveBeenCalledOnce();
    expect(registry.getState('loop:section:0', 'sku-question').status).toBe('idle');
    expect(registry.activeAnswerInstanceId).toBe('loop:section:1');
    expect(registry.request('loop:section:0', 'sku-question', () => of(['wrong-instance']))).toBe(false);
    expect(registry.request('loop:section:1', 'sku-question', () => of(['iteration-2']))).toBe(true);
    expect(registry.getState('loop:section:1', 'sku-question').data).toEqual(['iteration-2']);
  });

  it('retains the last successful data while refreshing and after a failed refresh', () => {
    const registry = new DynamicDataRequestRegistry<readonly string[]>();
    registry.request('root', 'question', () => of(['cached']));
    registry.request('root', 'question', () => throwError(() => new Error('network')));

    expect(registry.getState('root', 'question')).toMatchObject({
      status: 'error',
      data: ['cached'],
      error: expect.objectContaining({ message: 'network' }),
    });
  });

  it('publishes immutable state transitions and marks empty completion as successful', () => {
    const registry = new DynamicDataRequestRegistry<string[]>();
    const states: string[] = [];
    const subscription = registry.stateChanges$.subscribe(({ state }) => states.push(state.status));

    registry.request('root', 'question', () => new Observable<string[]>((subscriber) => subscriber.complete()));

    expect(states).toEqual(['loading', 'success']);
    expect(Object.isFrozen(registry.getState('root', 'question'))).toBe(true);
    subscription.unsubscribe();
  });

  it('handles a synchronous request factory failure without leaking a loading state', () => {
    const registry = new DynamicDataRequestRegistry<unknown>();
    const error = new Error('factory failed');

    expect(registry.request('root', 'question', () => {
      throw error;
    })).toBe(true);
    expect(registry.getState('root', 'question')).toMatchObject({
      status: 'error',
      error,
    });
  });

  it('cancels pending work on disposal and rejects future requests', () => {
    const registry = new DynamicDataRequestRegistry<string>();
    const teardown = vi.fn();
    registry.request('root', 'question', () => new Observable<string>(() => teardown()));

    registry.dispose();

    expect(teardown).toHaveBeenCalledOnce();
    expect(registry.getState('root', 'question').status).toBe('idle');
    expect(registry.request('root', 'other', () => of('ignored'))).toBe(false);
  });
});
