export class CaptchaResponse {
  // bot detect id
  captchaId!: string;
  // user entered bot detect code
  userEnteredCaptchaCode!: string;
  // Arcaptcha response and google ReCaptcha response
  captchaResponse!: string;
}
