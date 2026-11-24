export class ValidateVoterAnswerDetailDataOutputDto {
  validate!: boolean;
  validateGuid!: string | undefined;

  constructor(data?: ValidateVoterAnswerDetailDataOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
