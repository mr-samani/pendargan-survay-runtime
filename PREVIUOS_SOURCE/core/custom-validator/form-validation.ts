import { Injectable } from '@angular/core';
import { AbstractControl, ValidatorFn, FormGroup } from '@angular/forms';

@Injectable({ providedIn: 'root' })
export class CustomFormValidators {
  /**
   * بررسی صحت کد ملی
   * use invalidNationalCode
   * @param control  string
   */
  checkNationalCode(control: AbstractControl): { invalidNationalCode: boolean } | null {
    if (!control.value) {
      return null;
    }
    let num = control.value;
    let returnModel = '';
    const symbolMap: any = {
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
      '۰': '0',
    };
    num = num.toString();
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < num.length; i++) {
      if (symbolMap[num[i]]) {
        returnModel += symbolMap[num[i]];
      } else {
        returnModel += num[i];
      }
    }
    const nationalCode = returnModel;
    const isNumber = /^\d{10}$/.test(nationalCode);

    let isValid = false;

    if (isNumber && nationalCode.length === 10) {
      const allDigitEqual = [
        '0000000000',
        '1111111111',
        '2222222222',
        '3333333333',
        '4444444444',
        '5555555555',
        '6666666666',
        '7777777777',
        '8888888888',
        '9999999999',
      ];
      if (allDigitEqual.indexOf(nationalCode) > -1) {
        isValid = false;
      } else {
        const num0 = +nationalCode.charAt(0) * 10;
        const num2 = +nationalCode.charAt(1) * 9;
        const num3 = +nationalCode.charAt(2) * 8;
        const num4 = +nationalCode.charAt(3) * 7;
        const num5 = +nationalCode.charAt(4) * 6;
        const num6 = +nationalCode.charAt(5) * 5;
        const num7 = +nationalCode.charAt(6) * 4;
        const num8 = +nationalCode.charAt(7) * 3;
        const num9 = +nationalCode.charAt(8) * 2;
        const a = +nationalCode.charAt(9);

        const b = num0 + num2 + num3 + num4 + num5 + num6 + num7 + num8 + num9;
        const c = b % 11;

        if ((c < 2 && a === c) || (c >= 2 && 11 - c === a)) {
          isValid = true;
        } else {
          isValid = false;
        }
      }
    } else {
      isValid = false;
    }

    if (isValid === true) {
      return null;
    } else {
      return { invalidNationalCode: true };
    }
  }

  /**
   *  بررسی صحت شماره موبایل
   * use invalidMobile
   */
  checkMobileNumber(control: AbstractControl): { invalidMobile: boolean } | null {
    if (!control.value) {
      return null;
    }
    let num = control.value;
    let returnModel = '';
    const symbolMap: any = {
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
      '۰': '0',
    };
    num = num.toString();
    const mobileNumber = control.value
      .toString()
      .split('')
      .map((char: string) => symbolMap[char] ?? char)
      .join('');

    // باید دقیقاً 11 رقم باشد و با 0 شروع شود
    if (!/^0\d{10}$/.test(mobileNumber)) {
      return { invalidMobile: true };
    }

    // prettier-ignore
    const validPrefixes = [
      // irancel
      '930','933','935','936','937','938','939',
      '900','901','902','903','904','905','941',
      // MCI
      '910','911','912','913','914','915','916','917','918','919',
      '990','991','992','993','994','995','996', 
       // Rightel
      '920','921','922','923',
      // Espadan (MTCE)
      '931',
            // Taliya
      '921',
      // Kish-TCI
      '934',
      // Shatel
      '998',
      // samantel
      '999',
      //talia
      '932',
    ];
    const prefix = mobileNumber.substring(1, 4);

    return validPrefixes.includes(prefix) ? null : { invalidMobile: true };
  }

  /**
   * بررسی حروف فارسی
   * use pattern
   */
  checkPersianCharacters(control: AbstractControl): { pattern: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^([\u0600-\u06FF]+\s*)+$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { pattern: true };
    }
  }

  /**
   * بررسی حروف انگلیسی
   * use pattern
   */
  checkEnglishCharacters(control: AbstractControl): { pattern: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^([a-zA-Z]+\s*)+$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { pattern: true };
    }
  }

  /**
   * بررسی حروف انگلیسی و اعداد
   * use pattern
   */
  checkEnglishAndNumberCharacters(control: AbstractControl): { pattern: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^[a-zA-Z]+[a-zA-Z0-9-_]*$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { pattern: true };
    }
  }

  /**
   * با عدد شروع نشود
   *
   * use startWithNumber
   */
  notStartWithNumber(control: AbstractControl): { startWithNumber: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^[^0-9][a-zA-Z0-9_]\S*/.test(word);
    if (isValid) {
      return null;
    } else {
      return { startWithNumber: true };
    }
  }

  /**
   * بررسی تلفن ثابت به همراه کد
   * 0xxxxxxxxxx
   * use invalidPhoneNumber
   */
  checkPhoneNumber(control: AbstractControl): { invalidPhoneNumber: boolean } | null {
    if (!control.value) {
      return null;
    }
    let num = control.value;
    let returnModel = '';
    const symbolMap: any = {
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
      '۰': '0',
    };
    num = num.toString();
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < num.length; i++) {
      if (symbolMap[num[i]]) {
        returnModel += symbolMap[num[i]];
      } else {
        returnModel += num[i];
      }
    }

    const word = returnModel;
    const isValid = /^((?:0)[0-9]{10})$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { invalidPhoneNumber: true };
    }
  }

  /**
   * بررسی صحیت ایمیل
   * a@b.c
   * use email
   */
  checkEmail(control: AbstractControl): { email: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^[\w-.]+@([\w-]+\.)+[\w-]+$/.test(word); // /^.+@.+\..+$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { email: true };
    }
  }

  /**
   * بررسی کاراکترهای عددی
   * use pattern
   */
  checkNumberCharacters(control: AbstractControl): { pattern: boolean } | null {
    if (!control.value) {
      return null;
    }
    let num = control.value;
    let returnModel = '';
    const symbolMap: any = {
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
      '۰': '0',
    };
    num = num.toString();
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < num.length; i++) {
      if (symbolMap[num[i]]) {
        returnModel += symbolMap[num[i]];
      } else {
        returnModel += num[i];
      }
    }

    const word = returnModel;

    const isValid = /^-?(0|[1-9]\d*)?$/.test(word);
    if (isValid) {
      return null;
    } else {
      return { pattern: true };
    }
  }

  /**
   * حداقل 6 کاراکتر
   * حروف لاتین شامل اعداد و حروف بزرگ
   */
  strongPassword(control: AbstractControl): { weakPassword: boolean } | null {
    if (!control.value) {
      return null;
    }
    const word = control.value;
    const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[$@$!%?&^#*()_\-=+])[A-Za-z\d$@$!%?&^#*()_\-=+]{6,}$/.test(
      word,
    );
    if (isValid) {
      return null;
    } else {
      return { weakPassword: true };
    }
  }

  minimum(control: AbstractControl, min: number): { minmum: true } | null {
    if (!control.value) {
      return null;
    }
    if (control.value >= min) {
      return null;
    } else {
      return { minmum: true };
    }
  }

  range(min: number, max: number): ValidatorFn {
    return (c: AbstractControl): { [key: string]: boolean } | null => {
      if (c.value && (isNaN(c.value) || c.value < min || c.value > max)) {
        return { range: true };
      }
      return null;
    };
  }

  /**
   * پررسی صحت کد پستی ایران
   *
   *- تعداد کاراکتر های کد پستی 10 رقم باشند
   *- در 5 رقم اول کد پستی اعداد 0 و 2 معتبر نمی باشند
   *- رقم پنجم کد پستی عدد 5 معتبر نمی باشد
   *- رقم ششم کد پستی عدد 0 معتبر نمی باشد
   *- چهار رقم اخر کد پستی تمام اعداد معتبر می باشند(0 تا 9 )
   *-  درج 0000 در چهار رقم اخر کدپستی نامعتبر است
   *
   * @param control
   * @returns { invalidPostalCode: boolean }
   */
  checkPostalCode(control: AbstractControl): { invalidPostalCode: boolean } | null {
    if (!control.value) {
      return null;
    }

    let num = control.value;
    let normalized = '';
    const symbolMap: any = {
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
      '۰': '0',
    };

    num = num.toString().trim();
    // تبدیل ارقام فارسی به لاتین (در صورت وجود) و نرمال‌سازی رشته
    for (let i = 0; i < num.length; i++) {
      if (symbolMap[num[i]]) {
        normalized += symbolMap[num[i]];
      } else {
        normalized += num[i];
      }
    }

    const postalCode = normalized;
    const isNumber = /^\d{10}$/.test(postalCode);

    let isValid = true;

    // شرط کلی: باید دقیقا 10 رقم باشند و همه عدد باشند
    if (!isNumber) {
      isValid = false;
    } else {
      // 1- در 5 رقم اول (اندیس‌های 0..4) اعداد 0 و 2 معتبر نیستند
      for (let i = 0; i <= 4; i++) {
        const ch = postalCode.charAt(i);
        if (ch === '0' || ch === '2') {
          isValid = false;
          break;
        }
      }

      // 2- رقم پنجم (اندیس 4) نباید رقم 5 باشد
      if (isValid && postalCode.charAt(4) === '5') {
        isValid = false;
      }

      // 3- رقم ششم (اندیس 5) نباید 0 باشد
      if (isValid && postalCode.charAt(5) === '0') {
        isValid = false;
      }

      // 4- چهار رقم آخر (اندیس‌های 6..9) می‌توانند هر عددی باشند اما نباید "0000" باشند
      if (isValid && postalCode.substring(6) === '0000') {
        isValid = false;
      }
    }

    return isValid ? null : { invalidPostalCode: true };
  }
}
