import { DynamicDataFieldTypeDto } from './DynamicDataFieldTypeDto';

export class GetDemographyDataForViewOutputDto {
  dynamicDataFieldTypeDtos!: DynamicDataFieldTypeDto[] | undefined;
  dynamicJsonData!: string | undefined;
  databaseUniqueId!: string;
  fieldNamespacesToShow!: string[] | undefined;
  activeDynamicDataUniqueId!: string | undefined;
  activeDynamicDataTitle!: string | undefined;
  activeDynamicDataDescription!: string | undefined;
  messages!: string[] | undefined;

  constructor(data?: GetDemographyDataForViewOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
