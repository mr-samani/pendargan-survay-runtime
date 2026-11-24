export class CaptchaInput {
  captchaId!: string | undefined;
  userEnteredCaptchaCode!: string | undefined;

  constructor(data?: CaptchaInput) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}




