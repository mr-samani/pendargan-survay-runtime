import { FileEntityPairKeyDto } from './FileEntityPairKeyDto';

export class FileEntityPairValueDto {
  uniqueId!: string | undefined;
  tenantId!: number | undefined;
  value!: string | undefined;
  keyUniqueId!: string;
  keyFk!: FileEntityPairKeyDto;

  constructor(data?: FileEntityPairValueDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
