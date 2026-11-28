import { Injectable } from '@angular/core';

/*
۰۱۲۳۴۵۶۷۸۹
٠١٢٣٤٥٦٧٨٩
0123456789

iphone => ۰۱۲۳۴۵۶۷۸۹-٠١٢٣٤٥٦٧٨٩
*/
@Injectable({
  providedIn: 'root',
})
export class ConvertPersianArabicNumbersToEnglish {
  private persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  private arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];

  public fixNumbers(str: string): string {
    if (typeof str === 'string') {
      for (let i = 0; i < 10; i++) {
        str = str.replace(this.persianNumbers[i], i.toString()).replace(this.arabicNumbers[i], i.toString());
      }
    }
    return str;
  }
}
