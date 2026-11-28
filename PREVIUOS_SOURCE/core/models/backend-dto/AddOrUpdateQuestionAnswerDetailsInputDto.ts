import { CreateVoterAnswerDetailDto } from './CreateVoterAnswerDetailDto';
import { CreateVoterDto } from './CreateVoterDto';

export class AddOrUpdateQuestionAnswerDetailsInputDto {
  voterDetail!: CreateVoterDto;
  formQuestionUniqueId!: string;
  guid!: string;
  fileUploadList!: string[] | undefined;
  voterAnswerDetails!: CreateVoterAnswerDetailDto[] | undefined;
  loopIndexNumber!: number;
  hasLoop!: boolean;
  questionVariablesValue!: { [key: string]: string } | undefined;

  constructor(data?: AddOrUpdateQuestionAnswerDetailsInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
