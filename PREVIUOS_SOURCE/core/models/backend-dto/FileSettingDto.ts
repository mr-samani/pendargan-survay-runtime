import { FileEntityPairDto } from './FileEntityPairDto';
import { FileEntityPairKeyDto } from './FileEntityPairKeyDto';
import { FileEntityPairValueDto } from './FileEntityPairValueDto';

export class FileSettingDataDto {
    contentType!: string | undefined;
    extension!: string | undefined;
    minFileCount!: number | undefined;
    maxFileCount!: number | undefined;
    maxImageHeight!: number | undefined;
    maxImageWidth!: number | undefined;
    maxSize!: number | undefined;
    minImageHeight!: number | undefined;
    minImageWidth!: number | undefined;
    minSize!: number | undefined;
    validationCountdown!: string;
    keyUniqueId!: string;
    valueUniqueId!: string | undefined;
    id!: number;
    uniqueId!: string;
    tenantId!: number | undefined;

  constructor(data?: FileSettingDataDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
