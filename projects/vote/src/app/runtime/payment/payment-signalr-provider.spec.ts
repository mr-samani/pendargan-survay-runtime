import { describe, expect, it, vi } from 'vitest';
import type { HubConnection } from '@microsoft/signalr';
import {
  MicrosoftPaymentSignalRConnector,
  type PaymentSignalRClientOptions,
} from './payment-signalr-provider';

function createHarness(startResults: Array<() => Promise<void>> = [async () => {}]) {
  const callbacks = new Map<string, (payload?: unknown) => void>();
  const hub = {
    start: vi.fn(async () => {
      const next = startResults.shift();
      if (next) await next();
    }),
    stop: vi.fn(async () => {}),
    on: vi.fn((name: string, callback: (payload?: unknown) => void) => callbacks.set(name, callback)),
    off: vi.fn((name: string) => callbacks.delete(name)),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  } as unknown as HubConnection;
  const builder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn(() => hub),
  };
  const module = {
    HubConnectionBuilder: class { constructor() { return builder as never; } },
    LogLevel: { Warning: 3 },
  };
  return { hub, builder, module, callbacks };
}

describe('Microsoft SignalR payment connector', () => {
  it('starts a cookie-authenticated hub with automatic reconnect and exposes lifecycle callbacks', async () => {
    const harness = createHarness();
    const states: string[] = [];
    const options: PaymentSignalRClientOptions = {
      withCredentials: true,
      reconnectDelays: [0, 100, 500],
      initialStartRetryDelays: [],
      onStateChange: (state) => states.push(state),
    };
    const connector = new MicrosoftPaymentSignalRConnector(options, async () => harness.module as never);
    const connection = await connector.connect('https://example.test/signalr-Payment-Transaction?reservedPollGuid=poll');

    expect(harness.builder.withUrl).toHaveBeenCalledWith(
      'https://example.test/signalr-Payment-Transaction?reservedPollGuid=poll',
      { withCredentials: true },
    );
    expect(harness.builder.withAutomaticReconnect).toHaveBeenCalledWith([0, 100, 500]);
    expect(harness.hub.start).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['connecting', 'connected']);

    const reconnecting = (harness.hub.onreconnecting as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => void;
    const reconnected = (harness.hub.onreconnected as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => void;
    const closed = (harness.hub.onclose as ReturnType<typeof vi.fn>).mock.calls[0][0] as () => void;
    reconnecting();
    reconnected();
    closed();
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected', 'disconnected']);
    await connection.stop();
    expect(harness.hub.stop).toHaveBeenCalledTimes(1);
  });

  it('passes a configured access-token factory to the hub transport', async () => {
    const harness = createHarness();
    const accessTokenFactory = vi.fn(async () => 'fresh-token');
    const connector = new MicrosoftPaymentSignalRConnector(
      { accessTokenFactory, initialStartRetryDelays: [] },
      async () => harness.module as never,
    );
    await connector.connect('/hub');
    expect(harness.builder.withUrl).toHaveBeenCalledWith('/hub', {
      withCredentials: true,
      accessTokenFactory,
    });
  });

  it('retries initial start failures before giving up', async () => {
    const harness = createHarness([
      async () => { throw new Error('temporary network failure'); },
      async () => {},
    ]);
    const connector = new MicrosoftPaymentSignalRConnector(
      { initialStartRetryDelays: [0] },
      async () => harness.module as never,
    );
    await connector.connect('/hub');
    expect(harness.hub.start).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate hub subscriptions and detaches after the final listener is removed', async () => {
    const harness = createHarness();
    const connector = new MicrosoftPaymentSignalRConnector(
      { initialStartRetryDelays: [] },
      async () => harness.module as never,
    );
    const connection = await connector.connect('/hub');
    const first = vi.fn();
    const second = vi.fn();

    connection.on('payment', first);
    connection.on('payment', first);
    connection.on('payment', second);
    expect(harness.hub.on).toHaveBeenCalledTimes(1);

    harness.callbacks.get('payment')?.({ id: 1 });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    connection.off('payment', first);
    expect(harness.hub.off).not.toHaveBeenCalled();
    connection.off('payment', second);
    expect(harness.hub.off).toHaveBeenCalledWith('payment');
  });

  it('rejects blank URLs and cleans up a connection that never starts', async () => {
    const harness = createHarness([async () => { throw new Error('offline'); }]);
    const connector = new MicrosoftPaymentSignalRConnector(
      { initialStartRetryDelays: [] },
      async () => harness.module as never,
    );
    await expect(connector.connect('  ')).rejects.toThrow('non-empty SignalR hub URL');
    await expect(connector.connect('/hub')).rejects.toThrow('offline');
    expect(harness.hub.stop).toHaveBeenCalledTimes(1);
  });
});
