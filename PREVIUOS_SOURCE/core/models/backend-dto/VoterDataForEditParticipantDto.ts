import { DateTime } from 'luxon';

export class VoterDataForEditParticipantDto {
  voterGuid!: string;
  identificationCode!: number;
  registerDateAndTime!: DateTime;
  trackingCode!: string | undefined;

  constructor(data?: VoterDataForEditParticipantDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
