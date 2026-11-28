import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';

export class MatrixColumn {
  uniqueId!: string;
  description!: string;
  questionType?: FormQuestionTypesEnum;
  isEdit?: boolean;
}

export class MatrixRow {
  uniqueId!: string;
  title!: string;
  isEdit?: boolean;

  //panel on mobile
  isOpen?: boolean;
}
