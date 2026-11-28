import { ExpressionTargetsEnum } from './ExpressionTargetsEnum';
import { ExpressionActionsEnum } from './ExpressionActionsEnum';
import { FormExpressionTypeEnum } from './FormExpressionTypeEnum';

export class GetFormExpressionDto {
  expressionText!: string | undefined;
  designerCode!: string | undefined;
  targetType!: ExpressionTargetsEnum;
  isUserDefined!: boolean;
  // TODO: target key is uniqueIdPerForm
  targetKey!: string | undefined;
  actionType!: ExpressionActionsEnum;
  isActive!: boolean;
  formQuestionUniqueId!: string | undefined;
  formUniqueId!: string;
  uniqueId!: string;
  formExpressionType!: FormExpressionTypeEnum;
  reachMaxCount!: boolean | undefined;
  remainedPercent!: number | undefined;
  remainedCount!: number | undefined;

  constructor(data?: GetFormExpressionDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
