import { Component } from '@angular/core';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import { normalizeScalarAnswerValue, validateScalarAnswer } from './scalar-answer-value';

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

  get isCustomMask(): boolean {
    return this.question().questionType === FormQuestionTypesEnum.CustomMaskShortText;
  }

  get isReadOnly(): boolean {
    const q = this.question();
    return this.disabled() || (q.hasInitialValue === true && q.isEditableInitialValue === false);
  }

  get isLongText(): boolean {
    return this.question().questionType === FormQuestionTypesEnum.LongText;
  }

  get currentValue(): string | number {
    const value = this.question().answer;
    return typeof value === 'string' || typeof value === 'number' ? value : '';
  }

  get validationError(): string | null {
    const q = this.question();
    const result = validateScalarAnswer(q.questionType, q.answer, {
      required: q.isRequired === true,
      minimum: q.minimumAnswer,
      maximum: q.maximumAnswer,
      pattern: typeof q.settings?.['maskRegEx'] === 'string' ? q.settings['maskRegEx'] : null,
      isDecimal: q.settings?.['isDecimal'] === true,
      maxDecimalDigit: q.settings?.['maxDecimalDigit'] as number | string | null | undefined,
    });
    if (result?.code === 'required') return 'ThisFieldIsRequire';
    if (result?.code === 'email') return 'InvalidEmail';
    if (result?.code === 'mobile') return 'InvalidMobile';
    if (result?.code === 'phone') return 'InvalidPhoneNumber';
    if (result?.code === 'national-code') return 'InvalidNationalCode';
    if (result?.code === 'decimal-precision') return 'MaximumDecimalDigitsExceeded';
    if (result?.code === 'min') return 'MinimumValueNotReached';
    if (result?.code === 'max') return 'MaximumValueExceeded';
    return result ? 'InvalidValue' : null;
  }

  update(rawValue: string): void {
    if (this.isReadOnly) return;
    const question = this.question();
    let value = normalizeScalarAnswerValue(question.questionType, rawValue);
    question.answer = value;
    question.invalid.set(this.validationError !== null);
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
