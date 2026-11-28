import { DateTime } from 'luxon';

export class ChangeStatusAllocationInputDto {
  pollUniqueId!: string;
  allocationStatusUniqueId!: string;
  identificationCode!: number;
  userUniqueId!: string;
  newDateTime!: DateTime | undefined;
  allocationComment!: string | undefined;
}

export class ChangeStatusAllocationOutputDto {
  isSuccessful!: boolean;
  reasons!: string[] | undefined;
}

export class GetAllocationStatusForEditOutputDto {
  allocationStatus!: CreateOrEditAllocationStatusDto;
}

/*-----------------------------------------------------------------*/
export interface GetAllAllocationStatusInputDto {
  filter: string;
  teantId?: number;
  pollUniqueId: string;
  intendedAllocationStatusId?: number;
  notIncludes: number[];
  notInclude?: number;
  includeAllocationStatusBaseType: AllocationStatusBaseTypeEnum[];
  allocationTypeFilter: AllocationTypeEnum;
  maxResultCount: number;
  skipCount: number;
}

export class PagedResultDtoOfCreateOrEditAllocationStatusDto {
  totalCount!: number;
  items!: CreateOrEditAllocationStatusDto[] | undefined;
}
export class CreateOrEditAllocationStatusDto {
  title!: string;
  maxReturnCount!: number;
  scheduleType!: ScheduleTypeEnum;
  autoRetryMinute!: number;
  allocationStatusBaseType!: AllocationStatusBaseTypeEnum;
  commentType!: CommentTypeEnum;
  statusOrder!: number;
  isActive!: boolean;
  allocationSwitchingStatus!: AllocationStatusBaseTypeEnum;
  pollUniqueId!: string;
  uniqueId!: string;
  allocationStatusDescription!: string;
}

export enum ScheduleTypeEnum {
  None = 0,
  Manual = 1,
  Auto = 2,
}

export enum AllocationStatusBaseTypeEnum {
  Release = 2,
  InUse = 4,
  Successful = 8,
  Faild = 16,
  NewAllocation = 32,
}

export enum CommentTypeEnum {
  None = 2,
  HasComment = 4,
  RequiredComment = 8,
}
export enum AllocationTypeEnum {
  FieldAllocation = 2,
  TelephoneAllocation = 4,
}
