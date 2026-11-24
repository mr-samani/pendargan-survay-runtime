export class SendCodeValidateVoterAnswerDetailOutputDto {
  expirationTimeSecond!: number;
  codeWasSend!: boolean;

  constructor(data?: SendCodeValidateVoterAnswerDetailOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
