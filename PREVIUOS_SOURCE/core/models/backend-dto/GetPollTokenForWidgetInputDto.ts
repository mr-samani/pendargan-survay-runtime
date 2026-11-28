
export class GetPollTokenForWidgetInputDto {
  pollUniqueId!: string;
  tenantId!: number;

  constructor(data?: GetPollTokenForWidgetInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property))
          (<any> this)[property] = (<any> data)[property];
      }
    }
  }
}
