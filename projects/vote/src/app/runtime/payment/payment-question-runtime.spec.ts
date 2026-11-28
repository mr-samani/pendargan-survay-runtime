import { describe, expect, it, vi } from 'vitest';
import {
  PaymentQuestionRuntime,
  PollPaymentTransactionStatus,
  type PaymentQuestionContext,
  type PaymentQuestionPorts,
  type PaymentTransactionResult,
} from './payment-question-runtime';

const transactionId = 'transaction-1';
const validationGuid = 'a5f9a7b8-3f4c-4e7d-9b1a-2c3d4e5f6a7b';
const gateway = { tenantPaymentGatewayId: 'gateway-1', name: 'Gateway' };

function createContext(overrides: Partial<PaymentQuestionContext> = {}): PaymentQuestionContext {
  return {
    reservedPollGuid: 'reserved-poll',
    formQuestionUniqueId: 'payment-question',
    description: 'Order payment',
    amount: 125000,
    previewMode: false,
    hasInvalidPreviousQuestion: false,
    required: true,
    ...overrides,
  };
}

function createPorts(overrides: Partial<PaymentQuestionPorts> = {}): PaymentQuestionPorts {
  return {
    savePartial: vi.fn(async () => undefined),
    createOrGetTransaction: vi.fn(async (): Promise<PaymentTransactionResult> => ({
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.AwaitingPayment,
      pollPaymentTransactionExpireTimeSeconds: 120,
      targetUrl: 'https://gateway.example/pay',
      isSuccess: true,
    })),
    getTransactionInfo: vi.fn(async () => ({
      status: PollPaymentTransactionStatus.AwaitingPayment,
      pollPaymentTransactionExpireTimeSeconds: 90,
    })),
    validatePayment: vi.fn(async () => ({ validate: true, validateGuid: validationGuid })),
    cancelTransaction: vi.fn(async () => undefined),
    openPaymentUrl: vi.fn(),
    setPreviousQuestionsDisabled: vi.fn(),
    onAnswerChange: vi.fn(),
    ...overrides,
  };
}

describe('PaymentQuestionRuntime', () => {
  it('saves the partial survey before creating a transaction and opens the returned URL', async () => {
    const order: string[] = [];
    const ports = createPorts({
      savePartial: vi.fn(async () => { order.push('save'); }),
      createOrGetTransaction: vi.fn(async () => {
        order.push('transaction');
        return {
          pollPaymentTransactionId: transactionId,
          transactionStatus: PollPaymentTransactionStatus.AwaitingPayment,
          pollPaymentTransactionExpireTimeSeconds: 120,
          targetUrl: 'https://gateway.example/pay',
          isSuccess: true,
        };
      }),
      openPaymentUrl: vi.fn(() => { order.push('open'); }),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);

    await expect(runtime.checkout(gateway)).resolves.toBe(true);

    expect(order).toEqual(['save', 'transaction', 'open']);
    expect(runtime.state).toMatchObject({
      phase: 'awaiting-payment',
      transactionId,
      remainingSeconds: 120,
      partialDataSaved: true,
      previousQuestionsDisabled: true,
    });
    expect(ports.setPreviousQuestionsDisabled).toHaveBeenCalledWith(true);
  });

  it('does not save the partial survey twice when the user retries checkout', async () => {
    const ports = createPorts({
      createOrGetTransaction: vi.fn()
        .mockRejectedValueOnce(new Error('Gateway temporarily unavailable'))
        .mockResolvedValueOnce({
          pollPaymentTransactionId: transactionId,
          transactionStatus: PollPaymentTransactionStatus.AwaitingPayment,
          isSuccess: true,
        }),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);

    await expect(runtime.checkout(gateway)).resolves.toBe(false);
    await expect(runtime.checkout(gateway)).resolves.toBe(true);

    expect(ports.savePartial).toHaveBeenCalledTimes(1);
    expect(ports.createOrGetTransaction).toHaveBeenCalledTimes(2);
  });

  it('unlocks previous questions when the partial save fails', async () => {
    const ports = createPorts({
      savePartial: vi.fn(async () => { throw new Error('Save rejected'); }),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);

    await expect(runtime.checkout(gateway)).resolves.toBe(false);

    expect(ports.createOrGetTransaction).not.toHaveBeenCalled();
    expect(ports.setPreviousQuestionsDisabled).toHaveBeenNthCalledWith(1, true);
    expect(ports.setPreviousQuestionsDisabled).toHaveBeenNthCalledWith(2, false);
    expect(runtime.state).toMatchObject({
      phase: 'failed',
      previousQuestionsDisabled: false,
      partialDataSaved: false,
      error: 'Save rejected',
    });
  });

  it('rejects preview, invalid previous answers, missing gateway and invalid amounts before saving', async () => {
    const cases: Array<[PaymentQuestionContext, string]> = [
      [createContext({ previewMode: true }), 'preview'],
      [createContext({ hasInvalidPreviousQuestion: true }), 'previous'],
      [createContext({ amount: '' }), 'amount'],
      [createContext({ amount: Number.NaN }), 'amount'],
    ];
    for (const [context] of cases) {
      const ports = createPorts();
      const runtime = new PaymentQuestionRuntime(context, ports);
      await expect(runtime.checkout(gateway)).resolves.toBe(false);
      expect(ports.savePartial).not.toHaveBeenCalled();
      expect(ports.createOrGetTransaction).not.toHaveBeenCalled();
    }

    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await expect(runtime.checkout({ tenantPaymentGatewayId: '' })).resolves.toBe(false);
    expect(ports.savePartial).not.toHaveBeenCalled();
  });

  it('rejects a successful transaction response without an identifier', async () => {
    const ports = createPorts({
      createOrGetTransaction: vi.fn(async () => ({
        transactionStatus: PollPaymentTransactionStatus.AwaitingPayment,
        isSuccess: true,
      })),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);

    await expect(runtime.checkout(gateway)).resolves.toBe(false);
    expect(runtime.state).toMatchObject({ phase: 'failed', error: 'Payment service returned no transaction identifier.' });
  });

  it('uses the current reactive amount supplied by the host for transaction creation and validation', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext({ amount: 250 }), ports);

    await runtime.checkout(gateway);
    await runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Paid,
    });

    expect(ports.createOrGetTransaction).toHaveBeenCalledWith(expect.objectContaining({ transactionAmount: 250 }));
    expect(ports.validatePayment).toHaveBeenCalledWith(expect.objectContaining({ code: '250' }));
  });

  it('ignores SignalR events for another survey or transaction', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await expect(runtime.acceptSignalRStatus({
      reservedPollGuid: 'another-survey',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Paid,
    })).resolves.toBe(false);
    await expect(runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: 'another-transaction',
      transactionStatus: PollPaymentTransactionStatus.Paid,
    })).resolves.toBe(false);

    expect(ports.validatePayment).not.toHaveBeenCalled();
  });

  it('validates paid transactions and commits the server-issued GUID answer', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await expect(runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Completed,
    })).resolves.toBe(true);

    expect(runtime.state).toMatchObject({
      phase: 'paid',
      isValid: true,
      validationGuid,
      validationKey: transactionId,
      remainingSeconds: 0,
    });
    expect(ports.onAnswerChange).toHaveBeenCalledWith(validationGuid, transactionId);
  });

  it('does not accept a malformed validation GUID as a paid answer', async () => {
    const ports = createPorts({
      validatePayment: vi.fn(async () => ({ validate: true, validateGuid: 'not-a-guid' })),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Paid,
    });

    expect(runtime.state).toMatchObject({ phase: 'failed', isValid: false });
    expect(ports.onAnswerChange).toHaveBeenCalledWith(undefined, undefined);
  });

  it('supports manual transaction refresh when SignalR is unavailable', async () => {
    const ports = createPorts({
      getTransactionInfo: vi.fn(async () => ({
        status: PollPaymentTransactionStatus.Paid,
        gatewayTrackingCode: 'track-123',
        pollPaymentTransactionExpireTimeSeconds: 30,
      })),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await expect(runtime.refreshTransaction()).resolves.toBe(true);

    expect(ports.getTransactionInfo).toHaveBeenCalledWith(transactionId, 'reserved-poll');
    expect(runtime.state).toMatchObject({
      phase: 'paid',
      trackingCode: 'track-123',
      isValid: true,
    });
  });

  it('clears the pending answer and unlocks previous questions when payment expires', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    runtime.tick(120);

    expect(runtime.state).toMatchObject({
      phase: 'expired',
      remainingSeconds: 0,
      previousQuestionsDisabled: false,
      partialDataSaved: false,
    });
    expect(ports.onAnswerChange).toHaveBeenCalledWith(undefined, undefined);
    expect(ports.setPreviousQuestionsDisabled).toHaveBeenLastCalledWith(false);
  });

  it('cancels a transaction and resets the partial-save lock', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await expect(runtime.cancelPayment()).resolves.toBe(true);

    expect(ports.cancelTransaction).toHaveBeenCalledWith(transactionId, 'reserved-poll');
    expect(runtime.state).toMatchObject({
      phase: 'cancelled',
      transactionId: undefined,
      isValid: false,
      partialDataSaved: false,
      previousQuestionsDisabled: false,
    });
    expect(ports.onAnswerChange).toHaveBeenCalledWith(undefined, undefined);
    expect(ports.setPreviousQuestionsDisabled).toHaveBeenLastCalledWith(false);
  });

  it('retains the transaction and lock when server cancellation fails', async () => {
    const ports = createPorts({
      cancelTransaction: vi.fn(async () => { throw new Error('Cannot cancel'); }),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    await expect(runtime.cancelPayment()).resolves.toBe(false);

    expect(runtime.state).toMatchObject({
      transactionId,
      previousQuestionsDisabled: true,
      partialDataSaved: true,
      error: 'Cannot cancel',
    });
  });

  it('does not allow cancellation after payment has been validated', async () => {
    const ports = createPorts();
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);
    await runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Paid,
    });

    await expect(runtime.cancelPayment()).resolves.toBe(false);
    expect(ports.cancelTransaction).not.toHaveBeenCalled();
  });

  it('prevents duplicate checkout requests while the partial save is pending', async () => {
    let resolveSave!: () => void;
    const ports = createPorts({
      savePartial: vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; })),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);

    const first = runtime.checkout(gateway);
    await expect(runtime.checkout(gateway)).resolves.toBe(false);
    expect(ports.savePartial).toHaveBeenCalledTimes(1);

    resolveSave();
    await expect(first).resolves.toBe(true);
  });

  it('ignores stale validation completion after disposal', async () => {
    let resolveValidation!: (value: { validate: boolean; validateGuid: string }) => void;
    const ports = createPorts({
      validatePayment: vi.fn(() => new Promise((resolve) => { resolveValidation = resolve; })),
    });
    const runtime = new PaymentQuestionRuntime(createContext(), ports);
    await runtime.checkout(gateway);

    const validation = runtime.acceptSignalRStatus({
      reservedPollGuid: 'reserved-poll',
      pollPaymentTransactionId: transactionId,
      transactionStatus: PollPaymentTransactionStatus.Paid,
    });
    runtime.dispose();
    resolveValidation({ validate: true, validateGuid });
    await expect(validation).resolves.toBe(true);
    expect(runtime.state.isValid).toBe(false);
    expect(ports.onAnswerChange).not.toHaveBeenCalled();
  });
});
