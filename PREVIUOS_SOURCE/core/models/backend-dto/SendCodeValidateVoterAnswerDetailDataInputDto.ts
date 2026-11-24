import { VoterAnswerDetailValidationTypeEnum } from './VoterAnswerDetailValidationTypeEnum';

export class SendCodeValidateVoterAnswerDetailDataInputDto {
  formReserveGuid!: string;
  formQuestionUniqueId!: string;
  validationKey!: string | undefined;
  validationType!: VoterAnswerDetailValidationTypeEnum;

  constructor(data?: SendCodeValidateVoterAnswerDetailDataInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
