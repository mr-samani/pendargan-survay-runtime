import { computed, Service, signal } from '@angular/core';
import { QuestionModel } from '../models/question';
import type {
  GetAllFormDetailForViewOutputDto,
  GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';

@Service()
export class VoteService {
  questions: QuestionModel[] = [];
  // هر سوال در یک صفحه نشان داده شود
  oneQuestionPerPage = false;

  private pageQfrom = signal(0);
  private pageSize = signal(1000);

  // در حالت نمایش تک صفحه ای = در کدام صفحه هستیم
  private pageOffset = signal(0);

  readonly questionList = computed(() => {
    if (this.oneQuestionPerPage) {
      return this.questions.slice(this.pageOffset(), this.pageOffset() + 1);
    } else {
      return this.questions.slice(this.pageQfrom(), this.pageQfrom() + this.pageSize());
    }
  });

  async handleFormDetailsData(resp: GetAllFormDetailForViewOutputDto) {
    this.oneQuestionPerPage = resp.poll?.showOneQuestionInAnyPage == true;
    await this.iniitlizeQuestions(resp.formQuestions ?? []);
  }
  private async iniitlizeQuestions(questions: GetFormQuestionQuestionOptionDto[]) {
    questions = questions.filter((x) => x.isActive).sort((a, b) => a.sortKey! - b.sortKey!);
    const form = {};
    this.questions = [];

    for (let item of questions) {
      const q = new QuestionModel(item as QuestionModel);
      await q.loadComponent();
      this.questions.push(q);
    }
  }
}
