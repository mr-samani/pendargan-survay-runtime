import { FormSectionLoopQuestionAnswerDto } from '@core/models/backend-dto/voter-details/FormSectionLoopQuestionAnswerDto';
import { FormSectionQuestionAnswerDto } from '@core/models/backend-dto/voter-details/FormSectionQuestionAnswerDto';
import { GetFormQuestionAnswerDto } from '@core/models/backend-dto/voter-details/GetFormQuestionAnswerDto';
import { QuestionOptionDto } from '@core/models/backend-dto/voter-details/QuestionOptionDto';

export class VoterFormSection extends FormSectionQuestionAnswerDto {
  activeIndex?: number;
  override sectionLoopQuestionAnswerDetail: VoterSectionLoop[] = [];
}

export class VoterSectionLoop extends FormSectionLoopQuestionAnswerDto {
  showVariable?: boolean;
  declare sectionQuestionAnswerDetail: FormQuestionAnswerDto[];
}

export class FormQuestionAnswerDto extends GetFormQuestionAnswerDto {
  questionChild?: FormQuestionAnswerDto[] = [];
  override questionOptionDto: QuestionOption[] = [];
}

export class QuestionOption extends QuestionOptionDto {
  selected?: boolean;
}
