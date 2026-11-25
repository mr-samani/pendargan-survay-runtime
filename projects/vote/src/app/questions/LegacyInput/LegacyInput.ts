import { Component } from '@angular/core';
import { FormQuestionTypesEnum } from '@service-proxies/models';
import { QuestionBase } from '../shared/question.base';
import { QuestionSharedModule } from '../shared/shared.module';
import type { AnswerModel } from '../models/Answer';
import type { QuestionModel } from '../models/question';

@Component({
  selector: 'question-legacy-input',
  imports: [QuestionSharedModule],
  templateUrl: './LegacyInput.html',
  styleUrl: './LegacyInput.scss',
})
export class LegacyInput extends QuestionBase {
  readonly types = FormQuestionTypesEnum;

  get matrixRows(): readonly QuestionModel[] {
    const q = this.question();
    const rows = this.vote.questionList?.filter(item => item.parentUniqueId === q.uniqueId) ?? [];
    return rows.length ? rows : q.questionChilds;
  }

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
      if (!ids.includes(id) && ids.length >= Number(this.question().maximumAnswer ?? this.options.length)) return;
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
      this.publishPriority(next);
      return;
    }
    q.answer = option.uniqueId ?? '';
    this.publishRuntimeAnswerChange({
      kind: 'single-choice',
      questionRef: q.uniqueIdPerForm ?? q.uniqueId ?? '',
      optionRef: option.uniqueIdPerForm ?? option.uniqueId ?? '',
    });
  }

  movePriority(id: string, offset: number): void {
    if (this.disabled()) return;
    const ids = this.selectedIds;
    const index = ids.indexOf(id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    this.publishPriority(next);
  }

  private publishPriority(ids: readonly string[]): void {
    const q = this.question();
    const min = Number(q.minimumAnswer ?? (q.isRequired ? 1 : 0));
    const max = Number(q.maximumAnswer ?? this.options.length);
    const value = ids.join(',');
    q.answer = value;
    q.invalid.set(ids.length < min || ids.length > max);
    this.publishRuntimeAnswerChange({
      kind: 'question-value',
      questionRef: q.uniqueIdPerForm ?? q.uniqueId ?? '',
      value,
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
    const ids: string[] = typeof child.answer === 'string'
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
