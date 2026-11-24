import { Component } from '@angular/core';
import { QuestionSharedModule } from '../shared/shared.module';
import { QuestionBase } from '../shared/question.base';
import type { AnswerModel } from '../models/Answer';

@Component({
  selector: 'question-unique-select',
  imports: [QuestionSharedModule],
  templateUrl: './UniqueSelect.html',
  styleUrl: './UniqueSelect.scss',
})
export class UniqueSelect extends QuestionBase {
  selectionChange(a: AnswerModel) {
    if (this.disabled()) return;
    const q = this.question();

    let visibleCount = 0;
    for (let opt of q.questionOptions) {
      this.vote.form['@Q' + q.fid]['A' + opt.fid] = false;
      if (opt.canShow) {
        visibleCount++;
      }
    }

    this.vote.form['@Q' + q.fid]['A' + a.fid] = true;
    this.vote.form['@Q' + q.fid]['answer'] = a.uniqueId;
    this.vote.form['@Q' + q.fid]['Point'] = a.point ?? 0;
    this.vote.form['@Q' + q.fid]['AnswerTitle'] = a.title;
    this.vote.form['@Q' + q.fid]['PointWeigth'] = (a.point ?? 0) * (q.grade ?? 0);
    this.vote.form['@Q' + q.fid]['SelectedCount'] = 1;
    this.vote.form['@Q' + q.fid]['AnswersCount'] = visibleCount;
  }
}
