import { RepeatedFormSectionDto } from './RepeatedFormSectionDto';

export class VoterAnswerDetailListAndSectionIdDto {
  repeatSections!: RepeatedFormSectionDto[] | undefined;

  constructor(data?: VoterAnswerDetailListAndSectionIdDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
