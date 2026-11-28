import type { PaymentGatewayType } from '@service-proxies/models';

export enum PollPaymentTransactionStatus {
  NotPaid = 1,
  AwaitingPayment = 2,
  Paid = 3,
  Failed = 4,
  Cancelled = 5,
  Completed = 6,
}

export interface PaymentGateway {
  readonly tenantPaymentGatewayId: string;
  readonly name?: string | null;
  readonly gatewayType?: PaymentGatewayType;
}

export interface CreatePaymentTransactionInput {
  readonly pollPaymentTransactionId?: string;
  readonly reservedPollGuid: string;
  readonly formQuestionUniqueId: string;
  readonly transactionAmount: number;
  readonly paymentGatewayId: string;
  readonly transactionDescription?: string;
}

export interface PaymentTransactionResult {
  readonly targetUrl?: string;
  readonly pollPaymentTransactionId?: string;
  readonly transactionStatus: PollPaymentTransactionStatus;
  readonly pollPaymentTransactionExpireTimeSeconds?: number;
  readonly isExpired?: boolean;
  readonly message?: string;
  readonly isSuccess: boolean;
}

export interface PaymentTransactionInfo {
  readonly status: PollPaymentTransactionStatus;
  readonly gatewayTrackingCode?: string;
  readonly pollPaymentTransactionExpireTimeSeconds?: number;
  readonly isExpired?: boolean;
}

export interface PaymentValidationResult {
  readonly validate: boolean;
  readonly validateGuid?: string;
}

export interface PaymentSignalRStatusEvent {
  readonly reservedPollGuid: string;
  readonly pollPaymentTransactionId: string;
  readonly transactionStatus: PollPaymentTransactionStatus;
}

export interface PaymentQuestionContext {
  readonly reservedPollGuid: string;
  readonly formQuestionUniqueId: string;
  readonly description?: string;
  readonly amount: number | string | undefined;
  readonly previewMode: boolean;
  readonly hasInvalidPreviousQuestion: boolean;
  readonly required: boolean;
}

export interface PaymentQuestionPorts {
  /** Must resolve only after the host has durably accepted the partial save. */
  readonly savePartial: (gatewayId: string, questionId: string) => Promise<void>;
  readonly createOrGetTransaction: (input: CreatePaymentTransactionInput) => Promise<PaymentTransactionResult>;
  readonly getTransactionInfo: (transactionId: string, reservedPollGuid: string) => Promise<PaymentTransactionInfo>;
  readonly validatePayment: (input: {
    readonly code: string;
    readonly formQuestionUniqueId: string;
    readonly formReserveGuid: string;
    readonly validationKey: string;
  }) => Promise<PaymentValidationResult>;
  readonly cancelTransaction: (transactionId: string, reservedPollGuid: string) => Promise<void>;
  readonly openPaymentUrl: (url: string, gatewayName?: string | null) => void;
  readonly setPreviousQuestionsDisabled: (disabled: boolean) => void;
  readonly onAnswerChange: (value: string | undefined, validationKey: string | undefined) => void;
}

export type PaymentQuestionPhase =
  | 'idle'
  | 'saving-partial'
  | 'creating-transaction'
  | 'awaiting-payment'
  | 'checking'
  | 'validating'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface PaymentQuestionSnapshot {
  readonly phase: PaymentQuestionPhase;
  readonly transactionId?: string;
  readonly transactionStatus?: PollPaymentTransactionStatus;
  readonly trackingCode?: string;
  readonly validationGuid?: string;
  readonly validationKey?: string;
  readonly transactionAmount?: number;
  readonly remainingSeconds: number;
  readonly partialDataSaved: boolean;
  readonly previousQuestionsDisabled: boolean;
  readonly isValid: boolean;
  readonly error?: string;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPaid(status: PollPaymentTransactionStatus): boolean {
  return status === PollPaymentTransactionStatus.Paid ||
    status === PollPaymentTransactionStatus.Completed;
}

function isValidGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID_PATTERN.test(value);
}

function parseAmount(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Framework-agnostic payment question state machine.
 *
 * The host owns HTTP, SignalR, partial-save orchestration, navigation and UI.
 * This class owns ordering, duplicate-request guards, transaction correlation,
 * validation and answer-state transitions. Timer scheduling is host-owned;
 * call tick() with elapsed seconds from the host's clock.
 */
export class PaymentQuestionRuntime {
  private current: PaymentQuestionSnapshot = Object.freeze({
    phase: 'idle',
    remainingSeconds: 0,
    partialDataSaved: false,
    previousQuestionsDisabled: false,
    isValid: false,
  });
  private checkoutInFlight = false;
  private checkInFlight = false;
  private cancelInFlight = false;
  private validationInFlight = false;
  private validationRevision = 0;
  private disposed = false;

  constructor(
    private readonly context: PaymentQuestionContext,
    private readonly ports: PaymentQuestionPorts,
    private readonly onStateChange?: (state: PaymentQuestionSnapshot) => void,
  ) {}

  get state(): PaymentQuestionSnapshot {
    return this.current;
  }

  async checkout(gateway: PaymentGateway): Promise<boolean> {
    if (this.disposed || this.checkoutInFlight || this.current.isValid) return false;
    const amount = parseAmount(this.context.amount);
    if (amount === undefined || !this.context.reservedPollGuid ||
        !this.context.formQuestionUniqueId || !gateway.tenantPaymentGatewayId) {
      this.patch({ phase: 'failed', error: 'Payment amount, survey, question and gateway are required.' });
      return false;
    }
    if (this.context.previewMode) {
      this.patch({ phase: 'failed', error: 'Payment is unavailable in preview mode.' });
      return false;
    }
    if (this.context.hasInvalidPreviousQuestion) {
      this.patch({ phase: 'failed', error: 'Complete previous questions before payment.' });
      return false;
    }

    this.checkoutInFlight = true;
    this.disablePreviousQuestions();
    try {
      if (!this.current.partialDataSaved) {
        this.patch({ phase: 'saving-partial', error: undefined });
        await this.ports.savePartial(gateway.tenantPaymentGatewayId, this.context.formQuestionUniqueId);
        if (this.disposed) return false;
        this.patch({ partialDataSaved: true });
      }

      this.patch({ phase: 'creating-transaction', transactionAmount: amount, error: undefined });
      const result = await this.ports.createOrGetTransaction({
        pollPaymentTransactionId: this.current.transactionId,
        reservedPollGuid: this.context.reservedPollGuid,
        formQuestionUniqueId: this.context.formQuestionUniqueId,
        transactionAmount: amount,
        paymentGatewayId: gateway.tenantPaymentGatewayId,
        transactionDescription: this.context.description,
      });
      if (this.disposed) return false;

      if (result.pollPaymentTransactionId) {
        this.patch({
          transactionId: result.pollPaymentTransactionId,
          transactionStatus: result.transactionStatus,
        });
      }
      if (!result.isSuccess) {
        this.patch({ phase: 'failed', error: result.message || 'Payment transaction could not be created.' });
        return false;
      }
      if (!result.pollPaymentTransactionId) {
        this.patch({ phase: 'failed', error: 'Payment service returned no transaction identifier.' });
        return false;
      }

      this.patch({
        phase: isPaid(result.transactionStatus) ? 'validating' : 'awaiting-payment',
        remainingSeconds: Math.max(0, Math.floor(result.pollPaymentTransactionExpireTimeSeconds ?? 0)),
        error: undefined,
      });
      if (result.targetUrl) this.ports.openPaymentUrl(result.targetUrl, gateway.name);
      if (isPaid(result.transactionStatus)) return await this.validateCurrentTransaction();
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this.patch({ phase: 'failed', error: this.errorMessage(error, 'Payment checkout failed.') });
      // A failed partial save must unlock the previous questions. A later
      // transaction failure keeps the accepted partial snapshot locked so the
      // user can retry payment without resubmitting the survey.
      if (!this.current.partialDataSaved) this.enablePreviousQuestions();
      return false;
    } finally {
      this.checkoutInFlight = false;
    }
  }

  async refreshTransaction(): Promise<boolean> {
    const transactionId = this.current.transactionId;
    if (this.disposed || !transactionId || this.checkInFlight || this.current.isValid) return false;
    this.checkInFlight = true;
    const previousPhase = this.current.phase;
    this.patch({ phase: 'checking', error: undefined });
    try {
      const result = await this.ports.getTransactionInfo(transactionId, this.context.reservedPollGuid);
      if (this.disposed || this.current.transactionId !== transactionId) return false;
      this.patch({
        transactionStatus: result.status,
        trackingCode: result.gatewayTrackingCode,
        remainingSeconds: Math.max(0, Math.floor(result.pollPaymentTransactionExpireTimeSeconds ?? this.current.remainingSeconds)),
        phase: isPaid(result.status) ? 'validating' : result.isExpired ? 'expired' : 'awaiting-payment',
      });
      if (isPaid(result.status)) return await this.validateCurrentTransaction();
      if (result.isExpired) this.expirePayment();
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this.patch({ phase: previousPhase, error: this.errorMessage(error, 'Could not retrieve payment status.') });
      return false;
    } finally {
      this.checkInFlight = false;
    }
  }

  async acceptSignalRStatus(event: PaymentSignalRStatusEvent): Promise<boolean> {
    if (this.disposed || this.current.isValid || event.reservedPollGuid !== this.context.reservedPollGuid ||
        !this.current.transactionId ||
        event.pollPaymentTransactionId !== this.current.transactionId) return false;
    this.patch({ transactionStatus: event.transactionStatus });
    if (isPaid(event.transactionStatus)) {
      return await this.validateCurrentTransaction();
    } else if (event.transactionStatus === PollPaymentTransactionStatus.Cancelled) {
      this.patch({ phase: 'cancelled' });
    } else if (event.transactionStatus === PollPaymentTransactionStatus.Failed ||
               event.transactionStatus === PollPaymentTransactionStatus.NotPaid) {
      this.patch({ phase: 'failed' });
    }
    return true;
  }

  async cancelPayment(): Promise<boolean> {
    const transactionId = this.current.transactionId;
    if (this.disposed || !transactionId || this.cancelInFlight || this.current.isValid) return false;
    this.cancelInFlight = true;
    try {
      await this.ports.cancelTransaction(transactionId, this.context.reservedPollGuid);
      if (this.disposed) return false;
      this.validationRevision++;
      this.patch({
        phase: 'cancelled',
        transactionId: undefined,
        transactionStatus: PollPaymentTransactionStatus.Cancelled,
        trackingCode: undefined,
        isValid: false,
        validationGuid: undefined,
        validationKey: undefined,
        transactionAmount: undefined,
        remainingSeconds: 0,
        partialDataSaved: false,
        error: undefined,
      });
      this.enablePreviousQuestions();
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this.patch({ error: this.errorMessage(error, 'Could not cancel payment.') });
      return false;
    } finally {
      this.cancelInFlight = false;
    }
  }

  /** Timer callback from the host; accepts elapsed seconds, not a wall-clock value. */
  tick(elapsedSeconds = 1): void {
    if (this.disposed || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0 ||
        this.current.remainingSeconds <= 0 || this.current.isValid) return;
    const remainingSeconds = Math.max(0, this.current.remainingSeconds - Math.floor(elapsedSeconds));
    this.patch({ remainingSeconds });
    if (remainingSeconds === 0) this.expirePayment();
  }

  dispose(): void {
    this.disposed = true;
    this.validationRevision++;
    this.checkoutInFlight = false;
    this.checkInFlight = false;
    this.cancelInFlight = false;
    this.validationInFlight = false;
  }

  private async validateCurrentTransaction(): Promise<boolean> {
    const transactionId = this.current.transactionId;
    if (this.disposed || !transactionId || this.validationInFlight || this.current.isValid) return false;
    const revision = ++this.validationRevision;
    this.validationInFlight = true;
    this.patch({ phase: 'validating', error: undefined });
    try {
      const result = await this.ports.validatePayment({
        code: String(this.current.transactionAmount ?? this.context.amount ?? ''),
        formQuestionUniqueId: this.context.formQuestionUniqueId,
        formReserveGuid: this.context.reservedPollGuid,
        validationKey: transactionId,
      });
      if (this.disposed || revision !== this.validationRevision || transactionId !== this.current.transactionId || this.cancelInFlight) return false;
      if (!result.validate || !isValidGuid(result.validateGuid)) {
        this.patch({ phase: 'failed', isValid: false, validationGuid: undefined, validationKey: undefined,
          error: 'Payment could not be validated for the configured amount.' });
        this.ports.onAnswerChange(undefined, undefined);
        return false;
      }
      this.patch({
        phase: 'paid',
        isValid: true,
        validationGuid: result.validateGuid,
        validationKey: transactionId,
        remainingSeconds: 0,
        error: undefined,
      });
      this.ports.onAnswerChange(result.validateGuid, transactionId);
      return true;
    } catch (error) {
      if (!this.disposed && revision === this.validationRevision) {
        this.patch({ phase: 'failed', isValid: false, error: this.errorMessage(error, 'Payment validation failed.') });
      }
      return false;
    } finally {
      if (revision === this.validationRevision) this.validationInFlight = false;
    }
  }

  private expirePayment(): void {
    this.validationRevision++;
    this.patch({
      phase: 'expired',
      remainingSeconds: 0,
      isValid: false,
      validationGuid: undefined,
      validationKey: undefined,
      error: undefined,
    });
    this.ports.onAnswerChange(undefined, undefined);
    this.enablePreviousQuestions();
  }

  private disablePreviousQuestions(): void {
    if (this.current.previousQuestionsDisabled) return;
    this.ports.setPreviousQuestionsDisabled(true);
    this.patch({ previousQuestionsDisabled: true });
  }

  private enablePreviousQuestions(): void {
    if (!this.current.previousQuestionsDisabled) return;
    this.ports.setPreviousQuestionsDisabled(false);
    this.patch({ previousQuestionsDisabled: false, partialDataSaved: false });
  }

  private patch(patch: Partial<PaymentQuestionSnapshot>): void {
    this.current = Object.freeze({ ...this.current, ...patch });
    this.onStateChange?.(this.current);
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
