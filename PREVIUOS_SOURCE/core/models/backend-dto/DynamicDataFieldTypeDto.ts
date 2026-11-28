import { DynamicDataFieldDto } from './DynamicDataFieldDto';

export class DynamicDataFieldTypeDto {
  dynamicDataField!: DynamicDataFieldDto;
  value!: string | undefined;

  constructor(data?: DynamicDataFieldTypeDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
