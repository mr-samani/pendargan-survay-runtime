import { ExpressionActionsEnum } from './ExpressionActionsEnum';
import { FileVoterAnswerDetailsDto } from './FileVoterAnswerDetailsDto';

export class CreateVoterDto {
  latitude!: number | undefined;
  longitude!: number | undefined;
  gpsAccuracy!: number | undefined;
  guid!: string;
  elapsedTime!: number | undefined;
  regionUniqueId!: string | undefined;
  voiceRecordFileIdUnique!: FileVoterAnswerDetailsDto[] | undefined;
  expressionActions!: ExpressionActionsEnum | undefined;
  completionPercentage!: number;
  pollRoute!: string | undefined;

  constructor(data?: CreateVoterDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
