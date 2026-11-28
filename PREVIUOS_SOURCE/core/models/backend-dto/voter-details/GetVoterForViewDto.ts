import { VoterAndFormQuestionFilesLimitedDto } from './VoterAndFormQuestionFilesLimitedDto';
import { VoterDto } from './VoterDto';
import { DynamicDataFieldTypeDto } from './DynamicDataFieldTypeDto';

export class GetVoterForViewDto {
  voter!: VoterDto;
  pollTitle!: string | undefined;
  voterUserName!: string | undefined;
  voterUserFullName!: string | undefined;
  regionTitle!: string | undefined;
  questionerUserName!: string | undefined;
  questionerFullName!: string | undefined;
  voterTenantId!: number;
  voiceRecoredFiles!: VoterAndFormQuestionFilesLimitedDto[] | undefined;
  voiceRecoredFilesAsJson!: string | undefined;
  organizationUnitName!: string | undefined;
  demographyData!: DynamicDataFieldTypeDto[] | undefined;

  constructor(data?: GetVoterForViewDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
