import { GetFormExpressionDto } from './GetFormExpressionDto';
import { DynamicDataFieldTypeDto } from './DynamicDataFieldTypeDto';
import { GetDemographyDataForViewOutputDto } from './GetDemographyDataForViewOutputDto';
import { FileTokenDataDto } from './FileTokenDto';
import { GetAllPollRegionCapacityChildByPollId } from './GetAllPollRegionCapacityChildByPollId';
import { GetStatusDetailForHoldingPollViewDto } from './GetStatusDetailForHoldingPollViewDto';
import { GetQuestionOptionDto } from './GetQuestionOptionDto';
import { GetFormQuestionQuestionOptionDto } from './GetFormQuestionQuestionOptionDto';
import { GetFormSectionDto } from './GetFormSectionDto';
import { GetPollDto } from './GetPollDto';
import { GetFormDto } from './GetFormDto';
import { FormChecksumDto } from './FormChecksumDto';
import { GetFormGlobalVariableDto } from './GetFormGlobalVariableDto.1';
import { GetTempVoterForLoadDto } from './GetTempVoterForLoadDto';

export class GetAllFormDetailForViewOutputDto {
  formChecksum!: FormChecksumDto;
  form!: GetFormDto;
  poll!: GetPollDto;
  formSections!: GetFormSectionDto[] | undefined;
  formQuestions!: GetFormQuestionQuestionOptionDto[] | undefined;
  questionOptions!: GetQuestionOptionDto[] | undefined;
  statuses!: GetStatusDetailForHoldingPollViewDto[] | undefined;
  formGlobalVariables!: GetFormGlobalVariableDto[] | undefined;
  formExpressions!: GetFormExpressionDto[] | undefined;
  pollRegionCapacityDto!: GetAllPollRegionCapacityChildByPollId[] | undefined;
  formGuid!: string;
  canSubmit!: boolean;
  voiceRecordToken!: FileTokenDataDto;
  showPreviousFilledForms!: boolean;
  canNotParticipate!: boolean;
  demographyData!: GetDemographyDataForViewOutputDto;
  systemData!: DynamicDataFieldTypeDto[] | undefined;
  tempVoter!: GetTempVoterForLoadDto;

  constructor(data?: GetAllFormDetailForViewOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
