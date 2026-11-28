import type { Provider } from '@angular/core';
import { InjectionToken, inject } from '@angular/core';
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

/** Small root provider; the SignalR implementation and client load only on first payment use. */
class LazyPaymentSignalRConnector implements PaymentSignalRConnector {
  constructor(private readonly options: PaymentSignalRClientOptions) {}

  async connect(url: string): Promise<PaymentSignalRConnection> {
    const { MicrosoftPaymentSignalRConnector } = await import('./payment-signalr-connector.impl');
    return new MicrosoftPaymentSignalRConnector(this.options).connect(url);
  }
}

export function providePaymentSignalR(options: PaymentSignalRClientOptions = {}): Provider[] {
  return [
    { provide: PAYMENT_SIGNALR_OPTIONS, useValue: options },
    {
      provide: PAYMENT_SIGNALR_CONNECTOR,
      useFactory: () => new LazyPaymentSignalRConnector(inject(PAYMENT_SIGNALR_OPTIONS)),
    },
  ];
}
