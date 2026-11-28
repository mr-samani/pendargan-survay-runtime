import type { PaymentSignalRStatusEvent } from './payment-question-runtime';

/**
 * Serializes delivery of identical hub notifications.
 *
 * A notification is remembered only after a consumer accepts it. This keeps
 * concurrent/replayed SignalR frames from validating a transaction twice,
 * while allowing a later retry when the first validation attempt failed.
 */
export class PaymentSignalREventGate {
  private readonly inFlight = new Set<string>();
  private readonly accepted = new Set<string>();
  private readonly acceptedOrder: string[] = [];

  constructor(private readonly capacity = 256) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Payment SignalR deduplication capacity must be a positive integer.');
    }
  }

  async dispatch(
    event: PaymentSignalRStatusEvent,
    consume: (event: PaymentSignalRStatusEvent) => Promise<boolean>,
  ): Promise<boolean> {
    const key = this.keyOf(event);
    if (this.inFlight.has(key) || this.accepted.has(key)) return false;

    this.inFlight.add(key);
    try {
      const accepted = await consume(event);
      if (accepted) this.remember(key);
      return accepted;
    } finally {
      this.inFlight.delete(key);
    }
  }

  clear(): void {
    this.inFlight.clear();
    this.accepted.clear();
    this.acceptedOrder.length = 0;
  }

  private keyOf(event: PaymentSignalRStatusEvent): string {
    return event.reservedPollGuid + '\u0000' +
      event.pollPaymentTransactionId + '\u0000' + event.transactionStatus;
  }

  private remember(key: string): void {
    this.accepted.add(key);
    this.acceptedOrder.push(key);
    while (this.acceptedOrder.length > this.capacity) {
      const oldest = this.acceptedOrder.shift();
      if (oldest !== undefined) this.accepted.delete(oldest);
    }
  }
}
