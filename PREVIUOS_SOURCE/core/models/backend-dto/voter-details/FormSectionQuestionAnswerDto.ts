import { FormSectionLoopQuestionAnswerDto } from './FormSectionLoopQuestionAnswerDto';

export class FormSectionQuestionAnswerDto {
  formSectionUniqueId!: string;
  sectionLoopQuestionAnswerDetail!: FormSectionLoopQuestionAnswerDto[];

  constructor(data?: FormSectionQuestionAnswerDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.sectionLoopQuestionAnswerDetail = [];
    }
  }
}
