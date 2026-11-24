import { DateTime } from 'luxon';
import { ConvertNumbersToLatin } from './conver-number-to-latin.helper';

export abstract class UtcDateTimeHelper {
  /**
   * تبدیل تاریخ و ساعت دریافتی از کاربر به فرمت یو تی سی
   * @param localDate تاریخ
   * @param localTime ساعت
   * @returns تاریخ و ساعت به صورت UTC
   */
  public static convertLocalDateTimeToUTC(localDate: DateTime, localTime: string): string {
    if (localDate instanceof DateTime) {
      localTime = ConvertNumbersToLatin.fixNumbers(localTime);
      let l1 = ConvertNumbersToLatin.fixNumbers(localDate.toFormat('yyyy/MM/dd'));
      let l2 = DateTime.fromJSDate(new Date(l1 + ' ' + localTime));
      let utcDate = l2.toUTC().toISO();
      //   console.log(utcDate);
      return utcDate ?? '';
    } else {
      return '';
    }
  }

  /**
   * تبدیل تاریخ و ساعت یو تی سی به لوکال کاربر
   * @param datetime  UTC date time
   * @returns تاریخ و ساعت به لوکال کاربر
   */
  public static convertUtcToLocalDateTime(datetime: DateTime): LocalDateTime {
    // Intl not supported in safari
    // let userTimeZone =Intl.DateTimeFormat().resolvedOptions().timeZone;
    let userTimeZone = DateTime.local().zoneName ?? '';
    if (datetime instanceof DateTime === false) {
      datetime = DateTime.fromJSDate(new Date(datetime as any));
    }
    const localDateTime = datetime.setZone(userTimeZone);
    const result = {
      localDate: ConvertNumbersToLatin.fixNumbers(localDateTime.toFormat('yyyy/MM/dd')),
      localTime: ConvertNumbersToLatin.fixNumbers(localDateTime.toFormat('HH:mm')),
      localDateTime: localDateTime,
    };
    // console.log('convertUtcToLocalDateTime', datetime, result);
    return result;
  }
}

export interface LocalDateTime {
  localDate: string;
  localTime: string;

  localDateTime: DateTime;
}
