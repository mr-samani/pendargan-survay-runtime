import { QuestionJsonDataDto } from './backend-dto/QuestionJsonDataDto';
import { QuestionModel } from './QuestionModel';

export class SelectedSkuIteModel extends QuestionJsonDataDto {
  quantity: number = 0;
  total: number = 0;
  history: number[] = [];

  questionChilds: QuestionModel[] = [];
  formValid?: boolean;

  retaliVariables: { [key: string]: string } = {};

  // TODO: must be check
  questionOptionUniqueId?: string;

  constructor(data?: QuestionJsonDataDto) {
    super(data);
  }
  static initList(list: QuestionJsonDataDto[]): SelectedSkuIteModel[] {
    return list.map((m) => new SelectedSkuIteModel(m));
  }
}
