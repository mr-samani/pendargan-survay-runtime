export class FileEntityPairDto {
  key!: string | undefined;
  value!: string | undefined;

  constructor(data?: FileEntityPairDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
