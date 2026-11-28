import { CreateVoterAnswerDetailDto } from './CreateVoterAnswerDetailDto';

export class RepeatedFormSectionDto {
  voterAnswerDetails!: CreateVoterAnswerDetailDto[] | undefined;
  variablesRepeatedSectionValue!: { [key: string]: string } | undefined;

  constructor(data?: RepeatedFormSectionDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
