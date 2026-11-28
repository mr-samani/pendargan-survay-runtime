import { DateTime } from 'luxon';

export class GetTempVoterForLoadDto {
  elapsedTime!: number | undefined;
  completePercentage!: number;
  lastTempVoterChange!: DateTime;

  constructor(data?: GetTempVoterForLoadDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
