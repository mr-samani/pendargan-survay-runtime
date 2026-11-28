import { DateTime } from 'luxon';

export class FileTokenDataDto {
  expirationDate!: DateTime;
  fileSettingUniqueId!: string;
  userUniqueId!: string | undefined;
  valueUniqueId!: string | undefined;
  tenantToken!: number | undefined;
  userAgent!: string | undefined;
  id!: number;
  uniqueId!: string;

  constructor(data?: FileTokenDataDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
