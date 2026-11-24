import { PaymentGatewayType } from './PaymentGatewayType';

export class FormQuestionTenantPaymentGatewayListDto {
  name!: string | undefined;
  tenantPaymentGatewayId!: string;
  gatewayType!: PaymentGatewayType;
  formQuestionUniqueId!: string;

  constructor(data?: FormQuestionTenantPaymentGatewayListDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
