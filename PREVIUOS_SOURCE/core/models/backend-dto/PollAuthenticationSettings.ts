export class PollAuthenticationSettings {
  pollUniqueId!: string;
  title!: string | undefined;
  hasTwoFactorAuthentication!: boolean;
  hasCaptcha!: boolean;
  hasIdCode!: boolean;
  verificationCodeNumberCount!: number;
  verificationCodeSeconds!: number;
  description!: string | undefined;

  constructor(data?: PollAuthenticationSettings) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
