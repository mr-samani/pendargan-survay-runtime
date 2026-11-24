import { AllocationStatusBaseTypeEnum } from '@app/vote/allocation/allocation.model';

export class LoadDemographicInputDto {
  pollUniqueId?: string;
  trackingCode!: string;
  streamId!: string;
  dynamicDataId!: number;
  id?: number;
}

export class LoadDemographicOutputDto {
  [pollUniqueId: string]: DynamicDataProcessed;
}

export class DynamicDataProcessed {
  id!: string;
  dataRaw!: DataRowDic;
  dataProcessed!: DataRowDic;
  showData!: string;
  filled!: boolean;
  isTempVoter!: boolean;
  allocationStatusBaseType!: AllocationStatusBaseTypeEnum;
  allocationStatusTitle!: string;
  comment?: string;
  callTime?: string;

  allocationStartDate?: string;
  allocationEndDate?: string;
  hasVote?: boolean;
}

export interface DataRowDic {
  [key: string]: string;
}

export class LoadPollListInputDto {
  idCode!: string;
  dynamicDataId?: number;
  pollUniqueId?: string;
  openPollList?: boolean;
  pollId?: number;
}
