import { VoterAndFormQuestionFilesLimitedDto } from './VoterAndFormQuestionFilesLimitedDto';

export class VoterAnswerDetailDto {
  id!: number;
  answerScore!: number | undefined;
  questionPoint!: number | undefined;
  gradePoint!: number | undefined;
  orderAnswer!: number | undefined;
  answerTitle!: string | undefined;
  answerDescription!: string | undefined;
  isCalculatedScore!: boolean;
  voterSequentialUniqueId!: string;
  formQuestionUniqueId!: string;
  questionOptionUniqueId!: string | undefined;
  files!: VoterFileDetailDto[];
  dynamicDataRecordId!: number | undefined;
  settings!: { [key: string]: any };
  jsonValuesDictionary!: { [key: string]: string } | undefined;
  pollUniqueId!: string;
  formQuestionGrade!: number;
  validationGuid!: string | undefined;
  sequentialUniqueId!: string;
  loopNumber!: number | undefined;
  dynamicDataCode!: string | undefined;
  formQuestionInitialValue!: string | undefined;
  isFormQuestionInitialValueChanged!: boolean;

  constructor(data?: VoterAnswerDetailDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.files = [];
      this.settings = {};
    }
  }
}

export class VoterFileDetailDto {
  voterFileId!: string;
  voterSequentialUniqueId!: string;
  voterGuid!: string;
  pollUniqueId!: string;
  order!: number;
  formQuestionUniqueId!: string | undefined;
  voterAnswerDetailSequentialUniqueId!: string | undefined;
  filesDataIdUnique!: string;
  fileSettingUniqueId!: string;
  creationTime!: string;
  creationTimeTik!: number;
  isTempVoter!: boolean;
  loopIndexNumber!: number;
  isMobileFile!: boolean;
  hasLoop!: boolean;
  partialIndex!: number;
  voterFileType!: VoterFileTypeEnum;
  file!: VoterAndFormQuestionFilesLimitedDto;

  constructor(data?: VoterFileDetailDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
export enum VoterFileTypeEnum {
  VoterAnswerDetailFile = 0,
  VoiceFile = 1,
}
