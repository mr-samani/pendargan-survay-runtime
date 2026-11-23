import { Component } from '@angular/core';
import { QuestionBase } from '../shared/question.base';

@Component({
  selector: 'question-multi-select',
  imports: [],
  templateUrl: './MultiSelect.html',
  styleUrl: './MultiSelect.scss',
})
export class MultiSelect extends QuestionBase {}
