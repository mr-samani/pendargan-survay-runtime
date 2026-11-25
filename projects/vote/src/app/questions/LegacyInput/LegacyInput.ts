import { Component } from '@angular/core';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import type { AnswerModel } from '../models/Answer';

@Component({
  selector: 'question-legacy-input',
  imports: [QuestionSharedModule],
  templateUrl: './LegacyInput.html',
  styleUrl: './LegacyInput.scss',
})
export class LegacyInput extends QuestionBase {
  readonly types = FormQuestionTypesEnum;

  get options(): readonly AnswerModel[] {
    return this.question().questionOptions ?? [];
  }

  get numericValue(): number | null {
    const value = this.question().answer;
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  get scaleValues(): number[] {
    const q = this.question();
    const min = Number(q.minimumAnswer ?? (q.questionType === FormQuestionTypesEnum.NPS ? 0 : 1));
    const max = Number(q.maximumAnswer ?? (q.questionType === FormQuestionTypesEnum.NPS ? 10 : 5));
    const step = Math.max(Number(q.decimalStep ?? 1), 0.01);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
    const count = Math.min(Math.floor((max - min) / step) + 1, 101);
    return Array.from({ length: count }, (_, i) => Number((min + i * step).toFixed(4)));
  }

  isSelected(option: AnswerModel): boolean {
    const q = this.question();
    if (q.questionType === FormQuestionTypesEnum.HasPriority) {
      return this.selectedIds.includes(option.uniqueId ?? '');
    }
    return q.answer === option.uniqueId || option.selected === true;
  }

  get selectedIds(): string[] {
    const answer = this.question().answer;
    if (Array.isArray(answer)) return answer.map(String);
    return typeof answer === 'string' ? answer.split(/،|,/).map(x => x.trim()).filter(Boolean) : [];
  }

  selectById(id: string): void {
    const option = this.options.find(item => item.uniqueId === id);
    if (!option) {
      this.publishValue('');
      return;
    }
    this.selectOption(option);
  }

  matrixSelected(child: any, option: AnswerModel): boolean {
    if (child.questionType === FormQuestionTypesEnum.Matrix_Radio) {
      return child.answer === option.uniqueId;
    }
    const selected = typeof child.answer === 'string'
      ? child.answer.split(/،|,/).filter(Boolean)
      : [];
    return selected.includes(option.uniqueId ?? '');
  }

  numberOrEmpty(raw: string): number | '' {
    if (raw.trim() === '') return '';
    const value = Number(raw);
    return Number.isFinite(value) ? value : '';
  }

  selectOption(option: AnswerModel): void {
    if (this.disabled() || option.disabled || option.dontShow) return;
    const q = this.question();
    if (q.questionType === FormQuestionTypesEnum.HasPriority) {
      const ids = this.selectedIds;
      const id = option.uniqueId ?? '';
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      this.publishValue(next.join(','));
      return;
    }
    q.answer = option.uniqueId ?? '';
    this.publishRuntimeAnswerChange({
      kind: 'single-choice',
      questionRef: q.uniqueIdPerForm ?? q.uniqueId ?? '',
      optionRef: option.uniqueIdPerForm ?? option.uniqueId ?? '',
    });
  }

  setScale(value: number): void {
    this.publishValue(value);
  }

  setNumeric(raw: string): void {
    if (raw.trim() === '') {
      this.publishValue('');
      return;
    }
    const value = Number(raw);
    this.publishValue(Number.isFinite(value) ? value : '');
  }

  setMatrixValue(child: any, value: string | number): void {
    if (this.disabled()) return;
    child.answer = value;
    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: child.uniqueIdPerForm ?? child.uniqueId ?? '',
      value,
    });
  }

  setMatrixChoice(child: any, option: AnswerModel, checked: boolean): void {
    if (this.disabled()) return;
    const ref = child.uniqueIdPerForm ?? child.uniqueId ?? '';
    if (child.questionType === FormQuestionTypesEnum.Matrix_Radio) {
      child.answer = checked ? option.uniqueId : '';
      this.publishRuntimeAnswerChange({
        kind: 'question-value', questionRef: ref, value: child.answer,
      });
      return;
    }
    const ids = typeof child.answer === 'string'
      ? child.answer.split(/،|,/).filter(Boolean)
      : [];
    const id = option.uniqueId ?? '';
    const next = checked ? [...new Set([...ids, id])] : ids.filter(x => x !== id);
    child.answer = next.join(',');
    this.publishRuntimeAnswerChange({
      kind: 'question-value', questionRef: ref, value: child.answer,
    });
  }

  private publishValue(value: string | number): void {
    const q = this.question();
    q.answer = value;
    q.invalid.set(q.isRequired === true && value === '');
    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: q.uniqueIdPerForm ?? q.uniqueId ?? '',
      value,
    });
  }

  override clear(): void {
    this.publishValue('');
  }
}
