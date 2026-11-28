import { FileEntityPairValueDto } from './FileEntityPairValueDto';

export class FileEntityPairKeyDto {
  tenantId!: number | undefined;
  uniqueId!: string;
  key!: string | undefined;
  value!: FileEntityPairValueDto[] | undefined;

  constructor(data?: FileEntityPairKeyDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
