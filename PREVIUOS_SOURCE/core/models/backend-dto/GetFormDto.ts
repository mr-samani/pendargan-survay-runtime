export class GetFormDto {
  id!: number;
  title!: string | undefined;
  description!: string | undefined;
  uniqueId!: string;

  constructor(data?: GetFormDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
