import { CaptchaInput } from './CaptchaInput';

export class GetPollGuidByTokenInputDto {
  pollTokenValue!: string | undefined;
  twoFactorAuthenticationCode!: string | undefined;
  isSendTwoFactor!: boolean;
  idCode!: string | undefined;
  isNewVoter!: boolean;
  selectedVoterForRejectByParticipant!: string | undefined;
  captchaResponse!: CaptchaInput;

  constructor(data?: GetPollGuidByTokenInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
