export enum PollAuthenticationResultEnum {
  /**
   *  جی یو ای دی دارد - می تواند شروع کند
   */
  Success = 0,
  /**
   *  شما اجازه شرکت در نظر سنجی ندارید
   */
  NotAllowedPoll = 1,
  /**
   *  کپچا بگیر
   */
  CaptchaRequired = 2,
  /**
   *  دریافت شناسه کاربر
   */
  IdCodeRequired = 3,
  /**
   * - احراز هویت دو مرحله ای دارد
   * - دریافت کد تائید پیامک شده
   */
  TwoFactorAuthenticationRequired = 4,
  /**
   * کد پیامک شده را وارد کنید
   */
  TwoFactorAuthenticationCodeRequired = 5,
  /**
   *  قبلا در نظر سنجی شرکت کرده است
   */
  HasParticipatedOnce = 6,
  /**
   * انتخاب کنید در کدام نظر سنجی می خواهید شرکت کنید
   */
  PollIdOrTokenNotProvided = 7,

  /**
   * نظرسنجی احزار هویت دارد و کاربر باید وارد حساب کاربری خود شود
   */
  RequiredLogin = 8,
  /**
   *  احراز هویت دو مرحله ای فعال است
   * - دریافت شماره موبایل
   */
  MobileNumberRequired = 9,

  /**
   *  احراز هویت با سیستم خارجی دارد
   * - باید ریداریکت شود به  returnUrl
   */
  RedirectUrl = 10,

  /**
   *  دریافت Email کاربر
   */
  EmailRequired = 11,

  /**
   * guid ندارد
   * مشاهده لیست پاسخ نامه های قبلی و امکان جدید / رد نتیجه قبلی و ثبت جدید برای کاربر
   */
  RejectableVoterGuidNotProvided = 12,
}
