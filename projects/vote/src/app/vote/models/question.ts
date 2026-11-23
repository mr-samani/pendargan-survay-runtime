import { FormQuestionTypesEnum, GetFormQuestionQuestionOptionDto } from '@service-proxies/models';
import { AnswerModel } from './Answer';
import { validationAdditionalSettings } from '../utils/additional-settings-validate';
import { ArraySortPipe } from '../pipes/array-sort.pipe';
import { ArrayRandomizePipe } from '../pipes/randomize.pipe';
import type { Type } from '@angular/core';
import { DeclareQuestion } from '@questions';

export class QuestionModel extends GetFormQuestionQuestionOptionDto {
  answer: string | number = '';
  override questionOptions: AnswerModel[];

  questionChilds: QuestionModel[] = [];

  /** ایندکس پرسش ها
   * - start with 0
   */
  rowNumber: number;
  /**
   * uniqueIdPerForm without dash
   * - used in formula
   */
  fid: string;
  // for view matrix on mobile
  isOpen?: boolean;

  component!: Type<any>;

  constructor(data?: QuestionModel) {
    super();
    if (data) {
      for (let property in data) {
        if (data.hasOwnProperty(property)) {
          (this as any)[property] = (data as any)[property];
        }
      }
    }
    this.questionOptions ??= [];
    this.questionOptions = this.questionOptions.map((m) => new AnswerModel(m));

    this.settings = validationAdditionalSettings(this.questionType, this.settings);
    this.questionOptions.forEach((o) => {
      o.settings = validationAdditionalSettings(this.questionType, o.settings);
    });
    this.questionOptions = new ArraySortPipe().transform(this.questionOptions, 'rowNumber');
    if (this.isRandomizeAnswers) {
      this.questionOptions = new ArrayRandomizePipe().transform(
        this.questionOptions,
        true,
        this.randomizeLastOptionsExclusionCount,
      );
    }

    if ([FormQuestionTypesEnum.Point].indexOf(this.questionType!) > -1) {
      this.minimumAnswer = this.minimumAnswer ? +this.minimumAnswer : 0;
      this.maximumAnswer = this.maximumAnswer ? +this.maximumAnswer : 100;
      this.answer = this.answer ? +this.answer : this.minimumAnswer;
    }

    this.questionChilds ??= [];
    for (let i = 0; i < this.questionChilds.length; i++) {
      this.questionChilds[i] = new QuestionModel(this.questionChilds[i]);
    }
    this.rowNumber ??= 0;
    this.fid = this.uniqueIdPerForm?.replace(/-/g, '') ?? '';
  }

  async loadComponent() {
    this.component = await DeclareQuestion(this);
  }
}
