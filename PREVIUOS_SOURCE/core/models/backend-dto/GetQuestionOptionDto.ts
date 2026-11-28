import { DescriptionValueTypeEnum } from './DescriptionValueTypeEnum';

export class GetQuestionOptionDto {
  title!: string | undefined;
  rowNumber!: number;
  point!: number;
  hasDescriptiveAnswer!: boolean;
  isExclusive!: boolean;
  isDefault!: boolean;
  manualCode!: string | undefined;
  formQuestionUniqueId!: string;
  dimensionUniqueId!: string | undefined;
  settings!: { [key: string]: any };
  uniqueId!: string;
  additionalSettings!: string | undefined;
  tenantId!: number;
  requiredDescription!: boolean;
  descriptionType!: DescriptionValueTypeEnum;
  descriptionPlaceholder!: string | undefined;
  formUniqueId!: string;
  uniqueIdPerForm!: string;

  constructor(data?: GetQuestionOptionDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
    if (!data) {
      this.settings = {};
    }
  }
}
