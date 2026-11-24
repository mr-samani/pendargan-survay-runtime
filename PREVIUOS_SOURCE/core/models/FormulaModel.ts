import { GetFormExpressionDto } from './backend-dto/GetFormExpressionDto';

export class FormulaModel extends GetFormExpressionDto {
  result?: any;
  variables?: any;
  resultUpdated?: boolean;

  expressionReplacedText?: string;
  
}
