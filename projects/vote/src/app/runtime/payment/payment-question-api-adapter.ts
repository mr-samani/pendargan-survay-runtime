import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { API_BASE_URL } from '@service-proxies/core/api-config';
import {
  PollPaymentTransactionStatus,
  type CreatePaymentTransactionInput,
  type PaymentTransactionInfo,
  type PaymentTransactionResult,
  type PaymentValidationResult,
} from './payment-question-runtime';

export const PAYMENT_QUESTION_ENDPOINTS = Object.freeze({
  createOrGetTransaction: '/api/services/app/PublicPollPaymentTransaction/GetOrAddPollPaymentTransaction',
  getTransactionInfo: '/api/services/app/PublicPollPaymentTransaction/GetTransactionInfo',
  cancelTransaction: '/api/services/app/PublicPollPaymentTransaction/CancelPollPaymentTransaction',
  validatePayment: '/api/services/app/VoterAnswerDetailValidation/ValidateVoterAnswerDetailData',
});

export interface PaymentQuestionHttpTransport {
  post<TResponse>(url: string, body: unknown): Observable<TResponse>;
}

@Injectable({ providedIn: 'root' })
export class AngularPaymentQuestionHttpTransport implements PaymentQuestionHttpTransport {
  private readonly http = inject(HttpClient);

  post<TResponse>(url: string, body: unknown): Observable<TResponse> {
    return this.http.post<TResponse>(url, body);
  }
}

export const PAYMENT_QUESTION_HTTP_TRANSPORT = new InjectionToken<PaymentQuestionHttpTransport>(
  'PAYMENT_QUESTION_HTTP_TRANSPORT',
  {
    providedIn: 'root',
    factory: () => inject(AngularPaymentQuestionHttpTransport),
  },
);

interface ApiEnvelope<T> {
  readonly success?: boolean;
  readonly result?: T;
  readonly error?: { readonly message?: string | null } | null;
}

interface RawTransactionResult {
  readonly targetUrl?: string | null;
  readonly pollPaymentTransactionId?: string | null;
  readonly transactionStatus?: number;
  readonly pollPaymentTransactionExpireTimeSeconds?: number;
  readonly isExpired?: boolean;
  readonly message?: string | null;
  readonly isSuccess?: boolean;
}

interface RawTransactionInfo {
  readonly status?: number;
  readonly gatewayTrackingCode?: string | null;
  readonly pollPaymentTransactionExpireTimeSeconds?: number;
  readonly isExpired?: boolean;
}

interface RawPaymentValidation {
  readonly validate?: boolean;
  readonly validateGuid?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentQuestionApiAdapter {
  constructor(
    @Inject(PAYMENT_QUESTION_HTTP_TRANSPORT)
    private readonly transport: PaymentQuestionHttpTransport,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string,
  ) {}

  async createOrGetTransaction(input: CreatePaymentTransactionInput): Promise<PaymentTransactionResult> {
    const result = await this.postResult<RawTransactionResult>(
      PAYMENT_QUESTION_ENDPOINTS.createOrGetTransaction,
      {
        pollPaymentTransactionId: input.pollPaymentTransactionId,
        reservedPollGuid: input.reservedPollGuid,
        formQuestionUniqueId: input.formQuestionUniqueId,
        transactionAmount: input.transactionAmount,
        paymentGatewayId: input.paymentGatewayId,
        transactionDescription: input.transactionDescription,
      },
    );
    return Object.freeze({
      targetUrl: result.targetUrl ?? undefined,
      pollPaymentTransactionId: result.pollPaymentTransactionId ?? undefined,
      transactionStatus: readStatus(result.transactionStatus),
      pollPaymentTransactionExpireTimeSeconds: finiteOptional(result.pollPaymentTransactionExpireTimeSeconds),
      isExpired: result.isExpired === true,
      message: result.message ?? undefined,
      isSuccess: result.isSuccess === true,
    });
  }

  async getTransactionInfo(
    transactionId: string,
    reservedPollGuid: string,
  ): Promise<PaymentTransactionInfo> {
    const result = await this.postResult<RawTransactionInfo>(
      PAYMENT_QUESTION_ENDPOINTS.getTransactionInfo,
      { id: transactionId, reservedPollGuid },
    );
    return Object.freeze({
      status: readStatus(result.status),
      gatewayTrackingCode: result.gatewayTrackingCode ?? undefined,
      pollPaymentTransactionExpireTimeSeconds: finiteOptional(result.pollPaymentTransactionExpireTimeSeconds),
      isExpired: result.isExpired === true,
    });
  }

  async validatePayment(input: {
    readonly code: string;
    readonly formQuestionUniqueId: string;
    readonly formReserveGuid: string;
    readonly validationKey: string;
  }): Promise<PaymentValidationResult> {
    const result = await this.postResult<RawPaymentValidation>(
      PAYMENT_QUESTION_ENDPOINTS.validatePayment,
      {
        ...input,
        // Verified against the archived VoterAnswerDetailValidationTypeEnum.
        validationType: 8,
      },
    );
    return Object.freeze({
      validate: result.validate === true,
      validateGuid: result.validateGuid ?? undefined,
    });
  }

  async cancelTransaction(transactionId: string, reservedPollGuid: string): Promise<void> {
    const response = await firstValueFrom(this.transport.post<ApiEnvelope<unknown> | unknown>(
      this.url(PAYMENT_QUESTION_ENDPOINTS.cancelTransaction),
      { reservedPollGuid, pollPaymentTransactionId: transactionId },
    ));
    if (response && typeof response === 'object' && 'success' in response &&
        (response as ApiEnvelope<unknown>).success === false) {
      throw new Error((response as ApiEnvelope<unknown>).error?.message || 'The payment service rejected cancellation.');
    }
  }

  private async postResult<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await firstValueFrom(
      this.transport.post<ApiEnvelope<T> | T>(this.url(endpoint), body),
    );
    if (response && typeof response === 'object' && 'success' in response) {
      const envelope = response as ApiEnvelope<T>;
      if (envelope.success === false) {
        throw new Error(envelope.error?.message || 'The payment service rejected the request.');
      }
      if (envelope.result === undefined || envelope.result === null) {
        throw new Error('The payment service returned an empty result.');
      }
      return envelope.result;
    }
    if (response === undefined || response === null) {
      throw new Error('The payment service returned an empty response.');
    }
    return response as T;
  }

  private url(endpoint: string): string {
    const base = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
    return base + endpoint;
  }
}

function readStatus(value: unknown): PollPaymentTransactionStatus {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < PollPaymentTransactionStatus.NotPaid ||
      value > PollPaymentTransactionStatus.Completed) {
    throw new Error('The payment service returned an unknown transaction status.');
  }
  return value as PollPaymentTransactionStatus;
}

function finiteOptional(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
