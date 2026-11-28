import { QuestionJsonDataDto } from './QuestionJsonDataDto';
import { FormQuestionTypesEnum } from './FormQuestionTypesEnum';
import { FormQuestionTenantPaymentGatewayListDto } from './FormQuestionTenantPaymentGatewayListDto';
import { FileSettingDataDto } from './FileSettingDto';
import { FileTokenDataDto } from './FileTokenDto';
import { DescriptionValueTypeEnum } from './DescriptionValueTypeEnum';
import { GetQuestionOptionDto } from './GetQuestionOptionDto';
import { DynamicDataFieldExtendedDto } from './DynamicDataFieldExtendedDto';
import { DataPipeGroupDto } from './DataPipeGroupDto';

export class GetFormQuestionQuestionOptionDto {
  questionOptions!: GetQuestionOptionDto[] | undefined;
  formQuestionFileUploadTokenDtos!: FileTokenDataDto[] | undefined;
  fileUploadSettingDto!: FileSettingDataDto;
  title!: string | undefined;
  description!: string | undefined;
  questionType!: FormQuestionTypesEnum;
  point!: number | undefined;
  parentUniqueId!: string | undefined;
  questionDirection!: number | undefined;
  suffix!: string | undefined;
  isHTML!: boolean;
  dynamicDataUniqueId!: string | undefined;
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
  isCalculatedScore!: boolean;
  formUniqueId!: string;
  lastModifierUserId!: number;
  formSectionUniqueId!: string;
  manualCode!: string | undefined;
  grade!: number;
  dynamicDataFields!: DynamicDataFieldExtendedDto[] | undefined;
  dontShowAllWithoutSearch!: boolean;
  minimumTitle!: string | undefined;
  middleTitle!: string | undefined;
  maximumTitle!: string | undefined;
  settings!: { [key: string]: any } | undefined;
  htmlTitle!: string | undefined;
  dimensionUniqueId!: string | undefined;
  uniqueId!: string;
  tenantId!: number;
  additionalSettings!: string | undefined;
  initialDynamicDataAnswer!: QuestionJsonDataDto[] | undefined;
  decimalStep!: number | undefined;
  dataPipeGroups!: DataPipeGroupDto[] | undefined;
  hasVerification!: boolean;
  hasCameraCodeReader!: boolean;
  isUniqueAnswer!: boolean;
  maxChilledRandomSelect!: number | undefined;
  formQuestionTenantPaymentGateways!: FormQuestionTenantPaymentGatewayListDto[] | undefined;
  descriptionValueType!: DescriptionValueTypeEnum;
  uniqueIdPerForm!: string;
  sortKey!: number;
  childSortKey!: number | undefined;
  hasTrackChange!: boolean;

  constructor(data?: GetFormQuestionQuestionOptionDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
