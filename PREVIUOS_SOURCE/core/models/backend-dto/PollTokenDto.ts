import { DateTime } from 'luxon';


export class PollTokenDto {
  tenantId!: number;
  lastOpenTime!: DateTime;
  firstOpenTime!: DateTime | undefined;
  idCode!: number | undefined;
  expirationDate!: DateTime | undefined;
  isMultiUsage!: boolean;
  canSubmit!: boolean;
  forPreview!: boolean;
  token!: string | undefined;
  regionUniqueId!: string | undefined;
  selectedPendarganOrganizationUnitId!: string | undefined;
  userUniqueId!: string | undefined;
  pollUniqueId!: string;
  uniqueId!: string;
  id!: number;
  dynamicDataCode!: string | undefined;

  constructor(data?: PollTokenDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any> this)[property] = (<any> data)[property];
      }
    }
  }
}
