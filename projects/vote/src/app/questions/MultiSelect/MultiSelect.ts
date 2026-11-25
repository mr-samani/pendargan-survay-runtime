import { Component } from '@angular/core';
import { QuestionSharedModule } from '../shared/shared.module';
import { QuestionBase } from '../shared/question.base';

@Component({
  selector: 'question-multi-select',
  imports: [QuestionSharedModule],
  templateUrl: './MultiSelect.html',
  styleUrl: './MultiSelect.scss',
})
export class MultiSelect extends QuestionBase {
  selectionChange() {
    if (this.disabled()) return;
    const q = this.question();
    const val: string[] = [];
    const answerTitle: string[] = [];
    let points = 0;
    let selectedCount = 0;
    let visibleCount = 0;
    for (let opt of q.questionOptions) {
      if (opt.canShow) {
        visibleCount++;
      }
      if (this.vote.form['@Q' + q.fid]['A' + opt.fid] === true) {
        val.push(opt.uniqueId!);
        answerTitle.push(opt.title ?? '');
        points += opt.point ?? 0;
        selectedCount++;
      }
    }
    this.vote.form['@Q' + q.fid]['answer'] = val.join(', ');
    this.vote.form['@Q' + q.fid]['Point'] = points;
    this.vote.form['@Q' + q.fid]['AnswerTitle'] = answerTitle.join(', ');
    this.vote.form['@Q' + q.fid]['PointWeigth'] = points * (q.grade ?? 0);
    this.vote.form['@Q' + q.fid]['SelectedCount'] = selectedCount;
    this.vote.form['@Q' + q.fid]['AnswersCount'] = visibleCount;

    const questionRef = q.uniqueIdPerForm ?? q.uniqueId;
    const optionRefs = q.questionOptions
      .filter((option) => this.vote.form['@Q' + q.fid]['A' + option.fid] === true)
      .map((option) => option.uniqueIdPerForm ?? option.uniqueId)
      .filter((reference): reference is string => !!reference);
    if (questionRef) {
      this.publishRuntimeAnswerChange({ kind: 'multiple-choice', questionRef, optionRefs });
    }
  }
}
