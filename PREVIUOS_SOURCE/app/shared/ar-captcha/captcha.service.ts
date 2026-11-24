import { Injectable } from '@angular/core';
import { ReCaptchaV3Service } from 'ngx-captcha';
import { AppConsts } from '@core/app-consts';
declare var arcaptcha: any;

@Injectable({
  providedIn: 'root',
})
export class CheckCaptchaService {
  recaptchaSiteKey: string = AppConsts.recaptchaSiteKey;
  useArCaptcha = AppConsts.useArCaptcha;
  constructor(private reCaptchaV3Service: ReCaptchaV3Service) {}

  execute(action = 'login', callBack: any): void {
    if (this.useArCaptcha) {
      const token = arcaptcha?.getArcToken();
      callBack(token);
    } else {
      this.reCaptchaV3Service.execute(this.recaptchaSiteKey, action, (token) => {
        callBack(token);
      });
    }
  }

  reset(): void {
    if (this.useArCaptcha) {
      arcaptcha.reset();
    }
  }
}
