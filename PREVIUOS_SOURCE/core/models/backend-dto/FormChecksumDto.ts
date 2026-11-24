export class FormChecksumDto {
  serverTime!: number;
  hash!: string | undefined;
  forceCheck!: boolean | undefined;
  forceCorrectTime!: boolean | undefined;
  userUniqueId!: string | undefined;
  userName!: string | undefined;

  constructor(data?: FormChecksumDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
