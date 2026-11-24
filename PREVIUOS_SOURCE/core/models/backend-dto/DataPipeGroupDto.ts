import { DynamicDataFieldDto } from './DynamicDataFieldDto';
import { DynamicDataFieldSourceTypeEnum } from './DynamicDataFieldSourceTypeEnum';

export class DataPipeGroupDto {
  groupName!: string | undefined;
  groupKey!: string | undefined;
  dynamicDataFieldSourceType!: DynamicDataFieldSourceTypeEnum;
  dynamicDataFields!: DynamicDataFieldDto[] | undefined;

  constructor(data?: DataPipeGroupDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
