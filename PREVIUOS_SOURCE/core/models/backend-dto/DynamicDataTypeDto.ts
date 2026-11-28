import { DynamicDataCategoryEnum } from './DynamicDataCategoryEnum';
import { DynamicDataFieldTypeEnum } from './DynamicDataFieldTypeEnum';

export class DynamicDataTypeDto {
  id!: number;
  uniqueId!: string;
  title!: string;
  translatedTitle!: string | undefined;
  dataType!: DynamicDataFieldTypeEnum;
  minValueLength!: number;
  maxValueLength!: number;
  isRequiredColumn!: boolean;
  isUniqueColumnValue!: boolean;
  allowOneColumnOnly!: boolean;
  validationRegex!: string | undefined;
  dynamicDataCategoryId!: DynamicDataCategoryEnum;

  constructor(data?: DynamicDataTypeDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
