import { GetPollDto } from '@core/models/backend-dto/GetPollDto';

export interface ILocationService {
  /**
   * در هنگام ورود به فرم موقعیت مکانی کاربر دریافت می شود
   *
   */
  cachedUserPosition: UserPosition;

  /**
   * دریافت پرمیژن در ابتدای ورود به صفحه
   * @param minAccuracy حداقل دقت به متر
   * @param hasForcePresentLocation اجبار برای دریافت لوکیشن (فقط در موبایل)
   * @param forcePresentLocationRange محدوده (فقط در موبایل)
   * @param locationRequeredForVoterType نوع اجباری بودن دریافت موقعیت مکانی (اجباری باشد یا نه)
   */
  init(pollData: GetPollDto): void;
  /**
   * دریافت موقعیت مکانی کاربر
   * @param isSaveTemp در ذخیره موقت نیاز به دریافت لوکیشن کاربر نیست
   */
  getPosition(isSaveTemp: boolean): Promise<UserPosition>;
}

export interface UserPosition {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
}
