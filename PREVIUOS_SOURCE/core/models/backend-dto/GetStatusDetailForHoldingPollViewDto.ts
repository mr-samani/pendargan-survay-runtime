export class GetStatusDetailForHoldingPollViewDto {
  title!: string | undefined;
  description!: string | undefined;
  statusCategoryId!: number;
  lastModifierUserId!: number | undefined;

  constructor(data?: GetStatusDetailForHoldingPollViewDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
