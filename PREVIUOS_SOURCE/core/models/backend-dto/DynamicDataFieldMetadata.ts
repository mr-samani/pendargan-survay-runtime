export class DynamicDataFieldMetadata {
  key!: string | undefined;
  value!: string | undefined;
  title!: string | undefined;

  constructor(data?: DynamicDataFieldMetadata) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
