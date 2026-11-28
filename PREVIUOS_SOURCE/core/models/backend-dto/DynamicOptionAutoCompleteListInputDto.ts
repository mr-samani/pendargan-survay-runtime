export class DynamicOptionAutoCompleteListInputDto {
  dynamicDataUniqueId!: string | undefined;
  fieldToSearchIn!: string | undefined;
  fieldValueFilter!: string | undefined;
  secondaryFieldToSearchIn!: string | undefined;
  secondaryFieldValueFilter!: string | undefined;
  searchText!: string | undefined;
  resultsNumber!: number;
  formGuid!: string | undefined;
  searchWithoutSpace!: boolean;
  recordIdArrayToGet!: number[] | undefined;

  constructor(data?: DynamicOptionAutoCompleteListInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
