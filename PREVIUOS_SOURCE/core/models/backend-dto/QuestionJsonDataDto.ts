export class GetDynamicOptionAutoCompleteOutpotDto {
  questionJsonDataList!: QuestionJsonDataDto[] | undefined;
  totalCount!: number;

  constructor(data?: GetDynamicOptionAutoCompleteOutpotDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (this as any)[property] = (data as any)[property];
      }
    }
  }
}

export class QuestionJsonDataDto {
  dynamicDataUniqueId!: string;
  identificationCode!: string | number;
  answerTitle!: string | undefined;
  ordering!: number;
  jsonValuesDictionary!: { [key: string]: string } | undefined;
  answerTitleLower!: string | undefined;
  answerTitleLowerNoSpace!: string | undefined;

  constructor(data?: QuestionJsonDataDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
