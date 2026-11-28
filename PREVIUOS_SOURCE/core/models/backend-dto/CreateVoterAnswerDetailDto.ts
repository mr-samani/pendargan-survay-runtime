import { FileVoterAnswerDetailsDto } from './FileVoterAnswerDetailsDto';

export class CreateVoterAnswerDetailDto {
  orderAnswer!: number | undefined;
  answerTitle!: string | undefined;
  answerDescription!: string | undefined;
  formQuestionUniqueId!: string;
  questionOptionUniqueId!: string | undefined;
  files!: FileVoterAnswerDetailsDto[] | undefined;
  dynamicDataRecordId!: number | string | undefined;
  validationGuid!: string | undefined;
  formQuestionInitialValue!: string | undefined;

  constructor(data?: CreateVoterAnswerDetailDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
