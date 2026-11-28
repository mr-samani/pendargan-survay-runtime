export class SendChangePollPaymentTransactionStatusDto {
  public pollPaymentTransactionId!: string;
  public transactionStatus!: PollPaymentTransactionStatusEnum;

  public reservedPollGuid!: string;
}

export enum PollPaymentTransactionStatusEnum {
  NotPaid = 1,
  AwaitingPayment = 2,
  Paid = 3,
  Failed = 4,
  Cancelled = 5,
  Completed = 6,
}

export class GetOrAddPollPaymentTransactionInputDto {
  pollPaymentTransactionId!: string | undefined;
  reservedPollGuid!: string;
  formQuestionUniqueId!: string;
  transactionAmount!: number;
  paymentGatewayId!: string;
  transactionDescription!: string | undefined;
}

export class PollPaymentTransactionOfFormQuestionDto {
  targetUrl!: string | undefined;
  pollPaymentTransactionId!: string | undefined;
  transactionStatus!: PollPaymentTransactionStatusEnum;
  pollPaymentTransactionExpireTimeSeconds!: number;
  isExpired!: boolean;
  message!: string | undefined;
  isSuccess!: boolean;
}

/*-----------------------------------------------------------------*/

export class CancelPollPaymentTransactionInputDto {
  pollPaymentTransactionId!: string;
  reservedPollGuid!: string;
}
