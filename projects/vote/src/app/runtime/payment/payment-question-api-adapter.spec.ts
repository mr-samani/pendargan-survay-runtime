import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  PAYMENT_QUESTION_ENDPOINTS,
  PaymentQuestionApiAdapter,
  type PaymentQuestionHttpTransport,
} from './payment-question-api-adapter';
import { PollPaymentTransactionStatus } from './payment-question-runtime';

function createAdapter(response: unknown) {
  const post = vi.fn((_url: string, _body: unknown) => of(response));
  const adapter = new PaymentQuestionApiAdapter(
    { post } as unknown as PaymentQuestionHttpTransport,
    'https://api.example.test/',
  );
  return { adapter, post };
}

describe('PaymentQuestionApiAdapter', () => {
  it('uses the archived create-or-get endpoint and exact transaction DTO fields', async () => {
    const { adapter, post } = createAdapter({
      success: true,
      result: {
        targetUrl: 'https://gateway.example/pay',
        pollPaymentTransactionId: 'transaction-1',
        transactionStatus: 2,
        pollPaymentTransactionExpireTimeSeconds: 180,
        isExpired: false,
        isSuccess: true,
      },
    });

    await expect(adapter.createOrGetTransaction({
      pollPaymentTransactionId: 'previous-transaction',
      reservedPollGuid: 'reserved-poll',
      formQuestionUniqueId: 'payment-question',
      transactionAmount: 450000,
      paymentGatewayId: 'gateway-1',
      transactionDescription: 'Order payment',
    })).resolves.toEqual({
      targetUrl: 'https://gateway.example/pay',
      pollPaymentTransactionId: 'transaction-1',
      transactionStatus: PollPaymentTransactionStatus.AwaitingPayment,
      pollPaymentTransactionExpireTimeSeconds: 180,
      isExpired: false,
      message: undefined,
      isSuccess: true,
    });

    expect(post).toHaveBeenCalledWith(
      `https://api.example.test${PAYMENT_QUESTION_ENDPOINTS.createOrGetTransaction}`,
      {
        pollPaymentTransactionId: 'previous-transaction',
        reservedPollGuid: 'reserved-poll',
        formQuestionUniqueId: 'payment-question',
        transactionAmount: 450000,
        paymentGatewayId: 'gateway-1',
        transactionDescription: 'Order payment',
      },
    );
  });

  it('maps transaction status lookup and tracking information', async () => {
    const { adapter, post } = createAdapter({
      success: true,
      result: {
        status: 3,
        gatewayTrackingCode: 'track-123',
        pollPaymentTransactionExpireTimeSeconds: 42,
        isExpired: false,
      },
    });

    await expect(adapter.getTransactionInfo('tx-9', 'poll-2')).resolves.toEqual({
      status: PollPaymentTransactionStatus.Paid,
      gatewayTrackingCode: 'track-123',
      pollPaymentTransactionExpireTimeSeconds: 42,
      isExpired: false,
    });
    expect(post).toHaveBeenCalledWith(
      `https://api.example.test${PAYMENT_QUESTION_ENDPOINTS.getTransactionInfo}`,
      { id: 'tx-9', reservedPollGuid: 'poll-2' },
    );
  });

  it('sends ConfirmPayment validation type and maps the server-issued GUID', async () => {
    const { adapter, post } = createAdapter({
      success: true,
      result: { validate: true, validateGuid: 'a5f9a7b8-3f4c-4e7d-9b1a-2c3d4e5f6a7b' },
    });

    await expect(adapter.validatePayment({
      code: '125000',
      formQuestionUniqueId: 'payment-question',
      formReserveGuid: 'reserved-poll',
      validationKey: 'transaction-1',
    })).resolves.toEqual({
      validate: true,
      validateGuid: 'a5f9a7b8-3f4c-4e7d-9b1a-2c3d4e5f6a7b',
    });
    expect(post).toHaveBeenCalledWith(
      `https://api.example.test${PAYMENT_QUESTION_ENDPOINTS.validatePayment}`,
      {
        code: '125000',
        formQuestionUniqueId: 'payment-question',
        formReserveGuid: 'reserved-poll',
        validationKey: 'transaction-1',
        validationType: 8,
      },
    );
  });

  it('uses the legacy cancellation payload and propagates ABP business failures', async () => {
    const { adapter, post } = createAdapter({ success: true, result: {} });
    await expect(adapter.cancelTransaction('tx-1', 'poll-1')).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith(
      `https://api.example.test${PAYMENT_QUESTION_ENDPOINTS.cancelTransaction}`,
      { reservedPollGuid: 'poll-1', pollPaymentTransactionId: 'tx-1' },
    );

    const rejected = new PaymentQuestionApiAdapter(
      { post: () => of({ success: false, error: { message: 'Cancellation rejected' } }) } as unknown as PaymentQuestionHttpTransport,
      '/api',
    );
    await expect(rejected.cancelTransaction('tx-1', 'poll-1')).rejects.toThrow('Cancellation rejected');
  });

  it('rejects unknown statuses, empty envelopes and ABP failures instead of inventing defaults', async () => {
    const { adapter } = createAdapter({ success: true, result: { transactionStatus: 99, isSuccess: true } });
    await expect(adapter.createOrGetTransaction({
      reservedPollGuid: 'poll',
      formQuestionUniqueId: 'question',
      transactionAmount: 1,
      paymentGatewayId: 'gateway',
    })).rejects.toThrow('unknown transaction status');

    const empty = createAdapter({ success: true });
    await expect(empty.adapter.getTransactionInfo('tx', 'poll')).rejects.toThrow('empty result');

    const failed = createAdapter({ success: false, error: { message: 'Not authorized' } });
    await expect(failed.adapter.getTransactionInfo('tx', 'poll')).rejects.toThrow('Not authorized');
  });
});
