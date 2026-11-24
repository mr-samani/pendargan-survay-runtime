import * as c from 'crypto-js/aes';
import { DecodeString } from './atob-btoa';

export abstract class PollRoute {
  static get(formGuid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        let encryptedBytes = c.encrypt(formGuid, this.code);
        let encryptedString = encryptedBytes.toString();
        resolve(encryptedString);
        return encryptedString;
      } catch (error) {
        console.error('error in poll route!', error);
        reject(error);
        return '';
      }
    });
  }

  /**
   * btoa(r(btoa('16ByteSecretKey!')))
   */
  private static get code(): string {
    let str = DecodeString('PT1RSTVWMlMwVm1jalYyVWxSWGVDWlRN');
    str = this.r(str);
    str = DecodeString(str);
    return str;
  }
  private static r(str: string) {
    var newString = '';
    for (var i = str.length - 1; i >= 0; i--) {
      newString += str[i];
    }
    return newString;
  }
}
