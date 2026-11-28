import { describe, expect, it } from 'vitest';
import {
  PAYMENT_SIGNALR_EVENT,
  parsePaymentSignalRStatusEvent,
} from './payment-signalr-connector';

describe('payment SignalR contract', () => {
  it('uses the archived hub event name', () => {
    expect(PAYMENT_SIGNALR_EVENT).toBe('OnChangePollPaymentTransactionStatus');
  });

  it('accepts only complete transaction events with known status values', () => {
    expect(parsePaymentSignalRStatusEvent({
      reservedPollGuid: 'poll-guid',
      pollPaymentTransactionId: 'transaction-id',
      transactionStatus: 3,
    })).toEqual({
      reservedPollGuid: 'poll-guid',
      pollPaymentTransactionId: 'transaction-id',
      transactionStatus: 3,
    });
    expect(parsePaymentSignalRStatusEvent({
      reservedPollGuid: 'poll-guid',
      pollPaymentTransactionId: 'transaction-id',
      transactionStatus: 7,
    })).toBeUndefined();
    expect(parsePaymentSignalRStatusEvent({
      reservedPollGuid: 'poll-guid',
      transactionStatus: 3,
    })).toBeUndefined();
    expect(parsePaymentSignalRStatusEvent(null)).toBeUndefined();
  });
});
