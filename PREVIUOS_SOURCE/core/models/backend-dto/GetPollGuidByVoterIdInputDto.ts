export class GetPollGuidByVoterIdInputDto {
  pollUniqueId!: string;
  voterSequentialUniqueId!: string;

  constructor(data?: GetPollGuidByVoterIdInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
