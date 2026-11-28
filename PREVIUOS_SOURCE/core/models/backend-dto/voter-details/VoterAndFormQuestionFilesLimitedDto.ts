import { DateTime } from 'luxon';

export class VoterAndFormQuestionFilesLimitedDto {
  id!: number;
  tenantId!: number | undefined;
  extension!: string | undefined;
  size!: number | undefined;
  fileName!: string | undefined;
  fileServerNo!: number | undefined;
  contentType!: string | undefined;
  addressUrl!: string | undefined;
  uniqueId!: string;
  uploaderUserUniqueId!: string | undefined;
  binaryObjectThumbnails!: string | undefined;
  addressFromRoot!: string | undefined;
  addressFromDisk!: string | undefined;
  address!: string | undefined;
  creationTime!: DateTime;
  order!: number | undefined;
  creationTimeTik!: number | undefined;
  formQuestionUniqueId!: string | undefined;
  voterSequentialUniqueId!: string | undefined;
  voterGuid!: string | undefined;

  constructor(data?: VoterAndFormQuestionFilesLimitedDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
