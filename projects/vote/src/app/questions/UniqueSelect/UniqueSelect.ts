import { Component, input, model } from '@angular/core';
import type { QuestionModel } from '../models/question';
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
    const item = this.question();

    this.question().questionOptions.map(
      (x) => (this.vote.form['@Q' + item.fid]['A' + x.fid] = false),
    );
    this.vote.form['@Q' + item.fid]['A' + a.fid] = true;
    this.vote.form['@Q' + item.fid]['answer'] = a.uniqueId;
  }
}
