import { DynamicDataFieldMetadata } from './DynamicDataFieldMetadata';
import { DynamicDataFieldSourceTypeEnum } from './DynamicDataFieldSourceTypeEnum';
import { DynamicDataTypeDto } from './DynamicDataTypeDto';

export class DynamicDataFieldDto {
  id!: number;
  uniqueId!: string;
  title!: string | undefined;
  nameSpace!: string | undefined;
  isColumnTitle!: boolean;
  dataTypeUniqueId!: string | undefined;
  dynamicDataUniqueId!: string | undefined;
  order!: number;
  dynamicDataType!: DynamicDataTypeDto;
  tenantId!: number;
  possibleAnswers!: string | undefined;
  readonly possibleAnswersDictionary!: { [key: string]: DynamicDataFieldMetadata } | undefined;
  sourceType!: DynamicDataFieldSourceTypeEnum;
  viewNameSpace!: string | undefined;
  sourceKey!: string | undefined;
  sourceItemName!: string | undefined;

  constructor(data?: DynamicDataFieldDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
