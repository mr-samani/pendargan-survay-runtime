import type { Provider } from '@angular/core';
import { inject } from '@angular/core';
import {
  PAYMENT_SIGNALR_CONNECTOR,
  PAYMENT_SIGNALR_OPTIONS,
  type PaymentSignalRConnection,
  type PaymentSignalRConnector,
} from './payment-signalr-connector';

/** Convenience provider for hosts that want the concrete transport without importing its implementation. */
class LazyPaymentSignalRConnector implements PaymentSignalRConnector {
  constructor(private readonly options: import('./payment-signalr-connector').PaymentSignalRClientOptions) {}

  async connect(url: string): Promise<PaymentSignalRConnection> {
    const { MicrosoftPaymentSignalRConnector } = await import('./payment-signalr-connector.impl');
    return new MicrosoftPaymentSignalRConnector(this.options).connect(url);
  }
}

export function providePaymentSignalR(options?: import('./payment-signalr-connector').PaymentSignalRClientOptions): Provider[] {
  return [
    ...(options ? [{ provide: PAYMENT_SIGNALR_OPTIONS, useValue: options }] : []),
    {
      provide: PAYMENT_SIGNALR_CONNECTOR,
      useFactory: () => new LazyPaymentSignalRConnector(inject(PAYMENT_SIGNALR_OPTIONS)),
    },
  ];
}
