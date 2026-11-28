import { AllocationTypeEnum } from '@app/vote/allocation/allocation.model';
import { PollLogoPositionEnum } from './PollLogoPositionEnum';
import { VoterDataForEditParticipantDto } from './VoterDataForEditParticipantDto';
import { CheckPollTwoFactorAuthenticationOutputDto } from './CheckPollTwoFactorAuthenticationOutputDto';
import { PollAuthenticationResultEnum } from './PollAuthenticationResultEnum';
import { PollAuthenticationSettings } from './PollAuthenticationSettings';

export class GetPollGuidByTokenOutputDto {
  guid!: string | undefined;
  isSuccess!: boolean;
  authResult!: PollAuthenticationResultEnum;
  hasTwoFactorAuthentication!: boolean;
  hasCaptcha!: boolean;
  hasIdCode!: boolean;
  phoneNumber!: string | undefined;
  twoFactorResults!: CheckPollTwoFactorAuthenticationOutputDto[] | undefined;
  verificationCodeNumberCount!: number;
  verificationCodeSeconds!: number;
  fieldName!: string | undefined;
  message!: string | undefined;
  languageName!: string | undefined;
  useCameraCodeReaderInAuthenticate!: boolean;
  title!: string | undefined;
  description!: string | undefined;
  authenticationFieldDescription!: string | undefined;
  showFirstPage!: boolean;
  titleButtonToParticipate!: string | undefined;
  tenantId!: number;
  redirectUrl!: string | undefined;
  canSubmit!: boolean;
  jsonUIDesign!: string | undefined;
  headerPictureId!: string | undefined;
  logoPosition!: PollLogoPositionEnum;
  logoId!: string | undefined;
  companyTitle!: string | undefined;
  browserTitle!: string | undefined;
  availablePollSettings!: PollAuthenticationSettings[] | undefined;
  lastVoterOfParticipant!: VoterDataForEditParticipantDto;
  allocationType!: AllocationTypeEnum;
  iPollHasUnlimitedParticipation!: boolean;
  allowRejectResultByParticipant!: boolean;
  hasReRegistrationForm!: boolean;

  constructor(data?: GetPollGuidByTokenOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
