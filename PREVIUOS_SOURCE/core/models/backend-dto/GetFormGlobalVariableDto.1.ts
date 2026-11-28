import { FormGlobalVariableTypeEnum } from './FormGlobalVariableTypeEnum';

export class GetFormGlobalVariableDto {
  id!: number;
  expression!: string;
  title!: string;
  formUniqueId!: string;
  formQuestionUniqueId!: string;
  designerCode!: string | undefined;
  isUserDefined!: boolean;
  isSystemVariable!: boolean;
  isActive!: boolean;
  tenantId!: number;
  type!: FormGlobalVariableTypeEnum;
  uniqueId!: string;

  constructor(data?: GetFormGlobalVariableDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
