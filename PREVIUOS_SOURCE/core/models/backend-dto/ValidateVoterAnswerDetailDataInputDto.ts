import { VoterAnswerDetailValidationTypeEnum } from './VoterAnswerDetailValidationTypeEnum';

export class ValidateVoterAnswerDetailDataInputDto {
  formReserveGuid!: string;
  formQuestionUniqueId!: string;
  validationKey!: string | undefined;
  validationType!: VoterAnswerDetailValidationTypeEnum;
  code!: string | undefined;

  constructor(data?: ValidateVoterAnswerDetailDataInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
