import { computed, inject, Service, signal } from '@angular/core';
import { QuestionModel } from '../models/question';
import type {
  GetAllFormDetailForViewOutputDto,
  GetFormExpressionDto,
  GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
import { FormulaEngineService } from 'ngx-exp-parser';

@Service()
export class VoteService {
  protected readonly engine = inject(FormulaEngineService);
  questions: QuestionModel[] = [];
  // هر سوال در یک صفحه نشان داده شود
  oneQuestionPerPage = false;

  private pageQfrom = signal(0);
  private pageSize = signal(1000);

  // در حالت نمایش تک صفحه ای = در کدام صفحه هستیم
  private pageOffset = signal(0);

  form = this.engine.createReactiveModel<Record<string, any>>({});

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
    await this.initializeExpressions(resp.formExpressions ?? []);
  }
  private async iniitlizeQuestions(questions: GetFormQuestionQuestionOptionDto[]) {
    questions = questions.filter((x) => x.isActive).sort((a, b) => a.sortKey! - b.sortKey!);
    this.questions = [];

    for (let item of questions) {
      const q = new QuestionModel(item as QuestionModel);
      await q.loadComponent();
      this.form['@Q' + q.fid] = { answer: null };
      for (let opt of q.questionOptions) {
        this.form['@Q' + q.fid]['A' + opt.fid] = false;
      }
      this.questions.push(q);
    }
  }

  private initializeExpressions(expressions: GetFormExpressionDto[]) {
    for (let f of expressions) {
      if (!f.expressionText) continue;

      const q = this.questions.find((x) => x.uniqueId == f.formQuestionUniqueId);
      if (q) {
        q.conditions.push(f.expressionText);
      }
    }
  }
}
