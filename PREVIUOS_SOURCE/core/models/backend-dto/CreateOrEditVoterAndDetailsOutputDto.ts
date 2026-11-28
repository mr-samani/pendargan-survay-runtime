export class CreateOrEditVoterAndDetailsOutputDto {
  message!: string | undefined;
  trackingCode!: string | undefined;
  expirationSeconds!: number | undefined;

  constructor(data?: CreateOrEditVoterAndDetailsOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
