import { describe, expect, it } from 'vitest';
import { PaymentSignalREventGate } from './payment-signalr-event-gate';
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
    expect(parsePaymentSignalRStatusEvent({ reservedPollGuid: ' ', pollPaymentTransactionId: 'transaction-id', transactionStatus: 3 })).toBeUndefined();
    expect(parsePaymentSignalRStatusEvent({ reservedPollGuid: 'poll-guid', pollPaymentTransactionId: '', transactionStatus: 3 })).toBeUndefined();
  });
});

describe('payment SignalR event gate', () => {
  const event = {
    reservedPollGuid: 'poll-guid',
    pollPaymentTransactionId: 'transaction-id',
    transactionStatus: 3,
  } as const;

  it('coalesces concurrent duplicate notifications and remembers accepted events', async () => {
    const gate = new PaymentSignalREventGate();
    let calls = 0;
    let release!: (value: boolean) => void;
    const consume = async () => {
      calls++;
      return await new Promise<boolean>((resolve) => { release = resolve; });
    };

    const first = gate.dispatch(event, consume);
    const duplicate = await gate.dispatch(event, consume);
    expect(duplicate).toBe(false);
    expect(calls).toBe(1);

    release(true);
    expect(await first).toBe(true);
    expect(await gate.dispatch(event, consume)).toBe(false);
    expect(calls).toBe(1);
  });

  it('does not poison the dedupe cache when the consumer rejects an event', async () => {
    const gate = new PaymentSignalREventGate();
    expect(await gate.dispatch(event, async () => false)).toBe(false);
    expect(await gate.dispatch(event, async () => true)).toBe(true);
  });

  it('bounds remembered event keys and can be reset on teardown', async () => {
    const gate = new PaymentSignalREventGate(1);
    await gate.dispatch(event, async () => true);
    const next = { ...event, transactionStatus: 4 as const };
    await gate.dispatch(next, async () => true);
    expect(await gate.dispatch(event, async () => true)).toBe(true);
    gate.clear();
    expect(await gate.dispatch(next, async () => true)).toBe(true);
  });
});
