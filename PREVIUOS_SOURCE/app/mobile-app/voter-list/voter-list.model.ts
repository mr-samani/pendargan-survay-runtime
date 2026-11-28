import { VoterStatusEnum } from '@core/models/backend-dto/voter-details/VoterStatusEnum';
import { DateTime } from 'luxon';

export class GetVotersInputDto {
  pollUniqueId?: string;
  trackingCode?: string;
  pollId?: number;
}

export class VoterData {
  ////////// VOTER DTO ///////////

  id!: number;
  serverId?: number;

  identificationCode!: string;

  averagePoint?: number;

  averageGrade?: number;

  iP!: string;

  latitude?: number;

  longitude?: number;

  guid!: string;

  registerDate!: string;

  registerTime!: string;
  registerDateTime?: DateTime;

  userAgent!: string;

  isInfoMaked!: boolean;

  elapsedTime?: number;
  elapsedTimeString!: string;

  pollTokenVaule!: string;

  pollUniqueId!: string;

  status!: VoterStatusEnum;
  statusTranslatedString!: string;

  voterUserId?: number;

  regionId?: number;

  questionerUserId?: number;

  pollTokenId?: number;
  changeStatusReason!: string;

  ///////////////////////////////

  //public VoterDto Voter:  ;

  pollTitle!: string;

  voterUserName!: string;

  regionTitle!: string;

  questionerUserName!: string;

  questionerName!: string;

  questionerSurname!: string;

  voterTenantId!: number;

  state: ObjectStateEnum = ObjectStateEnum.Unsend;
  stateTranslatedString!: string;
  stateColor?: Color;
  loopIndexNumber: number = 1;
  trackingCode!: string;
  isSent!: boolean;
  isOnline?: boolean;

  voterUniqueId?: string;
}

export enum ObjectStateEnum {
  ServerDeny = -4,
  ServerFailed = -3,
  Deleted = -2,
  Failed = -1,
  Unsend = 0,
  Sent = 1,
  Sending = 2,
  NeedResend = 3,
  NotSentNeedResend = 4,
}

export class Color {
  r!: number;
  g!: number;
  b!: number;
  a!: number;
  isKnownColor!: boolean;
  isEmpty!: boolean;
  isNamedColor!: boolean;
  isSystemColor!: boolean;
  name!: string;
}
