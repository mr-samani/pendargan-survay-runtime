import { InjectionToken } from '@angular/core';
import type { PaymentSignalRStatusEvent } from './payment-question-runtime';

/**
 * Optional host adapter for the application's SignalR package/configuration.
 * Keeping the transport behind this boundary avoids bundling a second SignalR
 * client into the framework-agnostic payment runtime.
 */
export interface PaymentSignalRConnection {
  on(eventName: string, callback: (payload: unknown) => void): void;
  off(eventName: string, callback: (payload: unknown) => void): void;
  stop(): Promise<void>;
}

export interface PaymentSignalRConnector {
  /** Must configure reconnect behavior and resolve only after the hub is started. */
  connect(url: string): Promise<PaymentSignalRConnection>;
}

export const PAYMENT_SIGNALR_CONNECTOR = new InjectionToken<PaymentSignalRConnector>(
  'PAYMENT_SIGNALR_CONNECTOR',
);

export const PAYMENT_SIGNALR_EVENT = 'OnChangePollPaymentTransactionStatus';

export function parsePaymentSignalRStatusEvent(value: unknown): PaymentSignalRStatusEvent | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const event = value as Record<string, unknown>;
  if (typeof event['reservedPollGuid'] !== 'string' ||
      typeof event['pollPaymentTransactionId'] !== 'string' ||
      typeof event['transactionStatus'] !== 'number' ||
      !Number.isInteger(event['transactionStatus']) ||
      event['transactionStatus'] < 1 || event['transactionStatus'] > 6) {
    return undefined;
  }
  return Object.freeze({
    reservedPollGuid: event['reservedPollGuid'],
    pollPaymentTransactionId: event['pollPaymentTransactionId'],
    transactionStatus: event['transactionStatus'] as PaymentSignalRStatusEvent['transactionStatus'],
  });
}
