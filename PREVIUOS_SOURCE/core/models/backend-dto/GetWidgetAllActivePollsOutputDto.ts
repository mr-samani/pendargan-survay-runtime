import { DateTime } from 'luxon';

export class GetWidgetAllActivePollsOutputDto {
  pollUniqueId!: string;
  id!: number;
  title!: string | undefined;
  description!: string | undefined;
  startDate!: DateTime | undefined;
  endDate!: DateTime | undefined;
  logoId!: string | undefined;
  tenantId!: number;

  constructor(data?: GetWidgetAllActivePollsOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
