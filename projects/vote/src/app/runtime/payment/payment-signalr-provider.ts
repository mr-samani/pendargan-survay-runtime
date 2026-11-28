import type { Provider } from '@angular/core';
import { InjectionToken, inject } from '@angular/core';
import type { HubConnection } from '@microsoft/signalr';
import {
  PAYMENT_SIGNALR_CONNECTOR,
  type PaymentSignalRConnection,
  type PaymentSignalRConnector,
} from './payment-signalr-connector';

export type PaymentSignalRConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface PaymentSignalRClientOptions {
  readonly withCredentials?: boolean;
  readonly accessTokenFactory?: () => string | Promise<string>;
  readonly reconnectDelays?: readonly number[];
  readonly initialStartRetryDelays?: readonly number[];
  readonly onStateChange?: (state: PaymentSignalRConnectionState, error?: Error) => void;
}

export const PAYMENT_SIGNALR_OPTIONS = new InjectionToken<PaymentSignalRClientOptions>(
  'PAYMENT_SIGNALR_OPTIONS',
  { factory: () => ({ withCredentials: true }) },
);

interface SignalRBuilder {
  withUrl(url: string, options: { withCredentials: boolean; accessTokenFactory?: () => string | Promise<string> }): SignalRBuilder;
  withAutomaticReconnect(delays: number[]): SignalRBuilder;
  configureLogging(level: number): SignalRBuilder;
  build(): HubConnection;
}

interface SignalRModule {
  readonly HubConnectionBuilder: new () => SignalRBuilder;
  readonly LogLevel: { readonly Warning: number };
}

type SignalRLoader = () => Promise<SignalRModule>;
const defaultLoader: SignalRLoader = async () => await import('@microsoft/signalr');

const DEFAULT_RECONNECT_DELAYS = [0, 2_000, 10_000, 30_000];
const DEFAULT_START_RETRY_DELAYS = [0, 1_000, 3_000];

/** Concrete ASP.NET Core SignalR transport, loaded only when a payment question is active. */
export class MicrosoftPaymentSignalRConnector implements PaymentSignalRConnector {
  constructor(
    private readonly options: PaymentSignalRClientOptions = { withCredentials: true },
    private readonly loadSignalR: SignalRLoader = defaultLoader,
  ) {}

  async connect(url: string): Promise<PaymentSignalRConnection> {
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new TypeError('A non-empty SignalR hub URL is required.');
    }

    this.options.onStateChange?.('connecting');
    const signalR = await this.loadSignalR();
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        withCredentials: this.options.withCredentials ?? true,
        ...(this.options.accessTokenFactory ? { accessTokenFactory: this.options.accessTokenFactory } : {}),
      })
      .withAutomaticReconnect([...(this.options.reconnectDelays ?? DEFAULT_RECONNECT_DELAYS)])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    hub.onreconnecting((error) => this.options.onStateChange?.('reconnecting', error));
    hub.onreconnected(() => this.options.onStateChange?.('connected'));
    hub.onclose((error) => this.options.onStateChange?.('disconnected', error));

    try {
      await this.startWithRetry(hub);
      this.options.onStateChange?.('connected');
      return new MicrosoftPaymentSignalRConnection(hub);
    } catch (error) {
      this.options.onStateChange?.('disconnected', error instanceof Error ? error : undefined);
      await hub.stop().catch(() => undefined);
      throw error;
    }
  }

  private async startWithRetry(hub: HubConnection): Promise<void> {
    const delays = this.options.initialStartRetryDelays ?? DEFAULT_START_RETRY_DELAYS;
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) await delay(delays[attempt - 1]);
      try {
        await hub.start();
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('SignalR could not establish its initial connection.');
  }
}

class MicrosoftPaymentSignalRConnection implements PaymentSignalRConnection {
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();
  private stopPromise?: Promise<void>;

  constructor(private readonly hub: HubConnection) {}

  on(eventName: string, callback: (payload: unknown) => void): void {
    if (!eventName || typeof callback !== 'function') return;
    let callbacks = this.handlers.get(eventName);
    if (!callbacks) {
      callbacks = new Set();
      this.handlers.set(eventName, callbacks);
    }
    if (callbacks.has(callback)) return;
    callbacks.add(callback);
    if (callbacks.size === 1) {
      this.hub.on(eventName, (payload: unknown) => {
        for (const handler of [...(this.handlers.get(eventName) ?? [])]) handler(payload);
      });
    }
  }

  off(eventName: string, callback: (payload: unknown) => void): void {
    const callbacks = this.handlers.get(eventName);
    if (!callbacks?.delete(callback)) return;
    if (callbacks.size === 0) {
      this.handlers.delete(eventName);
      this.hub.off(eventName);
    }
  }

  stop(): Promise<void> {
    return this.stopPromise ??= this.hub.stop();
  }
}

function delay(milliseconds: number): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function providePaymentSignalR(options: PaymentSignalRClientOptions = {}): Provider[] {
  return [
    { provide: PAYMENT_SIGNALR_OPTIONS, useValue: options },
    {
      provide: PAYMENT_SIGNALR_CONNECTOR,
      useFactory: () => new MicrosoftPaymentSignalRConnector(inject(PAYMENT_SIGNALR_OPTIONS)),
    },
  ];
}
