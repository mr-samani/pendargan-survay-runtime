import { Component } from '@angular/core';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import { normalizeScalarAnswerValue } from './scalar-answer-value';

@Component({
  selector: 'question-scalar-answer',
  imports: [QuestionSharedModule],
  templateUrl: './ScalarAnswer.html',
  styleUrl: './ScalarAnswer.scss',
})
export class ScalarAnswer extends QuestionBase {
  readonly types = FormQuestionTypesEnum;

  get inputType(): string {
    switch (this.question().questionType) {
      case FormQuestionTypesEnum.Numeric: return 'number';
      case FormQuestionTypesEnum.Date: return 'date';
      case FormQuestionTypesEnum.Time: return 'time';
      case FormQuestionTypesEnum.Email: return 'email';
      default: return 'text';
    }
  }

  get isLongText(): boolean {
    return this.question().questionType === FormQuestionTypesEnum.LongText;
  }

  get currentValue(): string | number {
    const value = this.question().answer;
    return typeof value === 'string' || typeof value === 'number' ? value : '';
  }

  update(rawValue: string): void {
    if (this.disabled()) return;
    const question = this.question();
    const value = normalizeScalarAnswerValue(question.questionType, rawValue);
    question.answer = value;
    question.invalid.set(question.isRequired === true && value === '');
    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: question.uniqueIdPerForm ?? question.uniqueId ?? '',
      value,
    });
  }

  override clear(): void {
    this.update('');
  }
}
