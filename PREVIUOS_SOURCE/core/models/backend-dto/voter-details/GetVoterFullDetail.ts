import { GetVoterForViewDto } from './GetVoterForViewDto';
import { FormSectionQuestionAnswerDto } from './FormSectionQuestionAnswerDto';

export class GetVoterFullDetail {
  formSections!: FormSectionQuestionAnswerDto[];
  voterDetail!: GetVoterForViewDto;

  constructor(data?: GetVoterFullDetail) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.formSections = [];
    }
  }
}
