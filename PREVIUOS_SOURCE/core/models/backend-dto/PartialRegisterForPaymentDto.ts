export class PartialRegisterForPaymentDto {
  partialRegisterFormQuestionUniqueId!: string;
  tenantPaymentGatewayId!: string;

  constructor(data?: PartialRegisterForPaymentDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
