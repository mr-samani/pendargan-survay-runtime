import { DescriptionValueTypeEnum } from '../DescriptionValueTypeEnum';
import { FormQuestionTypesEnum } from '../FormQuestionTypesEnum';
import { QuestionOptionDto } from './QuestionOptionDto';
import { VoterAnswerDetailDto } from './VoterAnswerDetailDto';

export class GetFormQuestionAnswerDto {
  questionOptionDto!: QuestionOptionDto[];
  voterAnswerDetailDto!: VoterAnswerDetailDto[];
  title!: string | undefined;
  description!: string | undefined;
  questionType!: FormQuestionTypesEnum;
  rowNumber!: number;
  point!: number | undefined;
  parentUniqueId!: string | undefined;
  questionDirection!: number | undefined;
  suffix!: string | undefined;
  isHTML!: boolean;
  initialValue!: string | undefined;
  isEditableInitialValue!: boolean;
  hasInitialValue!: boolean;
  secondaryFilterValue!: string | undefined;
  descriptionType!: number | undefined;
  minimumAnswer!: number | undefined;
  maximumAnswer!: number | undefined;
  descriptionPlaceHolder!: string | undefined;
  isDescriptionRequired!: boolean;
  size!: number | undefined;
  partId!: number | undefined;
  hasDescription!: boolean;
  isActive!: boolean;
  isRequired!: boolean;
  isRandomizeMatrixQuestions!: boolean;
  isRandomizeAnswers!: boolean;
  randomizeLastOptionsExclusionCount!: number;
  matrixParts!: number | undefined;
  minimumTitle!: string | undefined;
  middleTitle!: string | undefined;
  maximumTitle!: string | undefined;
  uniqueId!: string;
  settings!: { [key: string]: any };
  decimalStep!: number | undefined;
  hasVerification!: boolean;
  hasCameraCodeReader!: boolean;
  formUniqueId!: string;
  formSectionUniqueId!: string;
  grade!: number;
  htmlTitle!: string | undefined;
  isCalculatedScore!: boolean;
  manualCode!: string | undefined;
  dynamicDataUniqueId!: string | undefined;
  dontShowAllWithoutSearch!: boolean;
  dimensionUniqueId!: string | undefined;
  additionalSettings!: string | undefined;
  isUniqueAnswer!: boolean;
  maxChilledRandomSelect!: number | undefined;
  descriptionValueType!: DescriptionValueTypeEnum;
  uniqueIdPerForm!: string;

  constructor(data?: GetFormQuestionAnswerDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.questionOptionDto = [];
      this.voterAnswerDetailDto = [];
      this.settings = {};
    }
  }
}
