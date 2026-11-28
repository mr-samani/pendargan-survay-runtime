import { PollPaymentTransactionStatusEnum } from '@app/vote/elements/payment/model';

export class GetTransactionInfoInputDto {
  id!: string;
  reservedPollGuid!: string;
}
export class GetTransactionInfoOutputDto {
  status!: PollPaymentTransactionStatusEnum;
  gatewayTrackingCode!: string | undefined;
  pollPaymentTransactionExpireTimeSeconds!: number;
  transactionAmount!: number;
  description!: string | undefined;
  isExpired!: boolean;
}
