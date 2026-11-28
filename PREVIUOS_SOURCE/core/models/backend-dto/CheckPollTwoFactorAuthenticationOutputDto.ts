export class CheckPollTwoFactorAuthenticationOutputDto {
  isValidCode!: boolean;
  twoFactorItem!: string | undefined;
  message!: string | undefined;
  remainVerificationCodeSeconds!: number;

  constructor(data?: CheckPollTwoFactorAuthenticationOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
