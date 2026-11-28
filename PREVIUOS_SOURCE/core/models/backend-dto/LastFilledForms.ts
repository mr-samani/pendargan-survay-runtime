import { DateTime } from 'luxon';
import { FormSectionQuestionAnswerDto } from './voter-details/FormSectionQuestionAnswerDto';

export class GetLatestFilledFormsInputDto {
  formGuid!: string;
  constructor(data?: GetLatestFilledFormsInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
export class PagedResultDtoOfPreviousFilledFormDto {
  items!: PreviousFilledFormDto[] | undefined;
  totalCount!: number;

  constructor(data?: PagedResultDtoOfPreviousFilledFormDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (this as any)[property] = (data as any)[property];
      }
    }
  }
}

export class PreviousFilledFormDto {
  voterSequentialUniqueId!: string;
  registerDate!: DateTime;
  formSections!: FormSectionQuestionAnswerDto[] | undefined;

  constructor(data?: PreviousFilledFormDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (this as any)[property] = (data as any)[property];
      }
    }
  }
}
