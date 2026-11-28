import { AllocationTypeEnum } from '@app/vote/allocation/allocation.model';
import { DateTime } from 'luxon';
import { PollTemporarySaveTypeEnum } from '../PollTemporarySaveTypeEnum';
import { Point } from './Point';
import { VotingSourceEnum } from './VotingSourceEnum';
import { VoterStatusEnum } from './VoterStatusEnum';

export class VoterDto {
  id!: number;
  identificationCode!: number | undefined;
  averagePoint!: number | undefined;
  averageGrade!: number | undefined;
  ip!: string | undefined;
  latitude!: number | undefined;
  longitude!: number | undefined;
  guid!: string;
  registerDate!: DateTime;
  registerTime!: DateTime;
  userAgent!: string | undefined;
  isInfoMaked!: boolean;
  elapsedTime!: number | undefined;
  elapsedTimeString!: string | undefined;
  pollTokenVaule!: string | undefined;
  pollUniqueId!: string;
  status!: VoterStatusEnum;
  voterUserUniqueId!: string | undefined;
  regionUniqueId!: string | undefined;
  questionerUserUniqueId!: string | undefined;
  pollTokenUniqueId!: string | undefined;
  changeStatusReason!: string | undefined;
  votingSource!: VotingSourceEnum;
  pendarganOrganizationUnitId!: string | undefined;
  organizationUnitCode!: string | undefined;
  loopIndexNumber!: number;
  tenantId!: number;
  lastModifierUserId!: number | undefined;
  lastModificationTime!: DateTime | undefined;
  allocationType!: AllocationTypeEnum;
  gpsAccuracy!: number | undefined;
  completionPercentage!: number;
  originalVoterGuid!: string | undefined;
  trackingCode!: string | undefined;
  trackingCodeTemplateId!: string | undefined;
  gisPoint!: Point;
  mobileSyncDownloadDateTime!: DateTime | undefined;
  voterSendToServerDateTime!: DateTime | undefined;
  mobileSyncDownloadGuid!: string | undefined;
  voterFilesCount!: number | undefined;
  distanceFromTarget!: number | undefined;
  totalLoopNumberForms!: number;
  partialIndex!: number;
  expirationTime!: DateTime | undefined;
  partialRegisterFormQuestionUniqueId!: string | undefined;
  temporarySaveType!: PollTemporarySaveTypeEnum;
  sequentialUniqueId!: string;
  authenticatePeriodUniqueId!: string | undefined;

  constructor(data?: VoterDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
