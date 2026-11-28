import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DateTime } from 'luxon';
import { ConvertNumbersToLatin } from '../helper/conver-number-to-latin.helper';
@Pipe({
  standalone: false,
  name: 'luxonFormat',
})
export class LuxonFormatPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(value: DateTime | string, format: string) {
    if (!value) {
      return '';
    }
    const localName = this.translateService.currentLang;
    // Intl not supported in safari
    // let userTimeZone =Intl.DateTimeFormat().resolvedOptions().timeZone;
    let userTimeZone = DateTime.local().zoneName ?? '';
    if (typeof value === 'string') {
      value = DateTime.fromJSDate(new Date(value));
    }
    let str = value
      .setZone(userTimeZone)
      .setLocale(localName)
      .reconfigure({
        outputCalendar: this.getCalendar,
      })
      .toFormat(format);
    return ConvertNumbersToLatin.fixNumbers(str);
  }

  private get getCalendar(): string {
    switch (this.translateService.currentLang) {
      case 'fa-IR':
      case 'fa':
        return Calendars.Persian;
      case 'ar':
        return Calendars.Islamic;
      default:
        return Calendars.iso8601;
    }
  }
}

export enum Calendars {
  iso8601 = 'iso8601',
  Buddhist = 'Buddhist',
  Chinese = 'Chinese',
  Coptic = 'Coptic',
  Ethioaa = 'Ethioaa',
  Ethiopic = 'Ethiopic',
  Hebrew = 'Hebrew',
  Indian = 'Indian',
  Islamic = 'Islamic',
  Islamicc = 'Islamicc',
  Japanese = 'Japanese',
  Persian = 'Persian',
  ROC = 'ROC', // Republic of China
}
