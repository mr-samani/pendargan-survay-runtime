export class PagedResultCustomDtoOfGetAllQuestionerConditionsOutputDtoDouble {
  items!: GetAllQuestionerConditionsOutputDto[] | undefined;
  totalCount!: number;
  customData!: number;
}
export class GetAllQuestionerConditionsOutputDto {
  id!: number;
  conditionCaseItems!: ConditionCaseItemDto[] | undefined;
  finalAllocatedPercentage!: number;
  roundedMaximumAllowedCapacity!: number;
}
export class ConditionCaseItemDto {
  fieldName!: string | undefined;
  fieldValue!: string | undefined;
  fieldTitle!: string | undefined;
  fieldValueTitle!: string | undefined;
}
