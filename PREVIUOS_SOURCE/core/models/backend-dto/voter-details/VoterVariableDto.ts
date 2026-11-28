import { FormGlobalVariableTypeEnum } from '../FormGlobalVariableTypeEnum';

export class VoterVariableDto {
  uniqueId!: string;
  name!: string | undefined;
  value!: string | undefined;
  isSystemVariable!: boolean;
  voterSequentialUniqueId!: string;
  formQuestionUniqueId!: string | undefined;
  type!: FormGlobalVariableTypeEnum;

  constructor(data?: VoterVariableDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
