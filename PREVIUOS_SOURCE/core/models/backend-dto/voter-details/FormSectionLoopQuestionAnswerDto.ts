import { GetFormQuestionAnswerDto } from './GetFormQuestionAnswerDto';
import { VoterVariableDto } from './VoterVariableDto';

export class FormSectionLoopQuestionAnswerDto {
  loopNumber!: number;
  sectionQuestionAnswerDetail!: GetFormQuestionAnswerDto[];
  voterVariables!: VoterVariableDto[];

  constructor(data?: FormSectionLoopQuestionAnswerDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.sectionQuestionAnswerDetail = [];
      this.voterVariables = [];
    }
  }
}
