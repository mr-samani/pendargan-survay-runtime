import { GetFormGlobalVariableDto } from './backend-dto/GetFormGlobalVariableDto';
import { QuestionModel } from './QuestionModel';

export class GlobalVariableModel extends GetFormGlobalVariableDto {
  question?: QuestionModel;
  variables?: string[] = [];
  result?: any;
  resultUpdated?: boolean;
}
