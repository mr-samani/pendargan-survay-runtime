import { ExpressionTargetsEnum } from './ExpressionTargetsEnum';
import { ExpressionActionsEnum } from './ExpressionActionsEnum';
export class TrackExpressionInputDto {
  formReservedGuid!: string;
  trackExpressionDetails!: TrackExpressionDetail[] | undefined;
  identificationCode!: number | undefined;
  dynamicDataCode!: string | undefined;
  pollUniqueId!: string;
  formUniqueId!: string;
  userUniqueId!: string | undefined;
  voterSequantialUniqueId!: string | undefined;
  trackingCode!: string | undefined;
  tenantId!: number;

  constructor(data?: TrackExpressionInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}

export class TrackExpressionDetail {
  expressionUniqueId!: string | undefined;
  targetKey!: string | undefined;
  targetType!: ExpressionTargetsEnum;
  actionType!: ExpressionActionsEnum;
  expressionText!: string | undefined;
  expressionResult!: string | undefined;
  expressionReplacedText!: string | undefined;

  constructor(data?: TrackExpressionDetail) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
