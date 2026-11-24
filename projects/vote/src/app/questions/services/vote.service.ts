import { computed, inject, Service, signal } from '@angular/core';
import { QuestionModel } from '../models/question';
import {
  ExpressionActionsEnum,
  ExpressionTargetsEnum,
  FormExpressionTypeEnum,
  type GetAllFormDetailForViewOutputDto,
  type GetFormExpressionDto,
  type GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
import { FormulaEngineService } from 'ngx-exp-parser';
import type { ExpressionModel } from '../models/Expression';
import { loadQuestionRenderers } from '../definitions';
import { Notify } from 'ngx-kit/notify';
import { MSG } from 'ngx-kit/message';

@Service()
export class VoteService {
  readonly engine = inject(FormulaEngineService);
  questions: QuestionModel[] = [];
  // هر سوال در یک صفحه نشان داده شود
  oneQuestionPerPage = false;
  showQuestionNumberInPollingPage = false;
  // TODO
  showRequiredFormQuestionValidate = false;

  private pageQfrom = signal(0);
  private pageSize = signal(1000);

  // در حالت نمایش تک صفحه ای = در کدام صفحه هستیم
  private pageOffset = signal(0);

  form = this.engine.createReactiveModel<Record<string, any>>({});

  /** برای تبدیل سریع فرمول یونیک ایدی به فرمول قابل فهم */
  stateMap = new Map<string, string>();

  readonly questionList = computed(() => {
    if (this.oneQuestionPerPage) {
      return this.questions.slice(this.pageOffset(), this.pageOffset() + 1);
    } else {
      return this.questions.slice(this.pageQfrom(), this.pageQfrom() + this.pageSize());
    }
  });

  async handleFormDetailsData(resp: GetAllFormDetailForViewOutputDto) {
    this.oneQuestionPerPage = resp.poll?.showOneQuestionInAnyPage === true;
    this.showQuestionNumberInPollingPage = resp.poll?.showQuestionNumberInPollingPage === true;
    await this.iniitlizeQuestions(resp.formQuestions ?? []);
    await this.initializeExpressions(resp.formExpressions ?? []);
  }
  private async iniitlizeQuestions(questions: GetFormQuestionQuestionOptionDto[]) {
    questions = questions.filter((x) => x.isActive).sort((a, b) => a.sortKey! - b.sortKey!);
    this.questions = [];

    let rowNumber = 0;
    for (let item of questions) {
      const q = new QuestionModel(item as QuestionModel);
      q.vote = this;
      q.rowNumber = ++rowNumber;
      this.stateMap.set('@Q' + q.fid, '#Q' + q.rowNumber);
      this.form['@Q' + q.fid] = { answer: null };

      let optRowNumber = 0;
      for (let opt of q.questionOptions) {
        this.form['@Q' + q.fid]['A' + opt.fid] = false;
        opt.rowNumber = ++optRowNumber;
        this.stateMap.set('@Q' + q.fid + '.A' + opt.fid, '#Q' + q.rowNumber + '.A' + optRowNumber);
      }
      this.questions.push(q);
    }

    // Load each distinct renderer once. Different types can download in parallel.
    const renderers = await loadQuestionRenderers(
      this.questions.map((question) => question.questionType),
    );
    for (const question of this.questions) {
      const renderer =
        question.questionType == null ? undefined : renderers.get(question.questionType);
      if (!renderer) {
        throw new Error(`Renderer was not loaded for question type: ${question.questionType}`);
      }
      question.component = renderer;
    }
  }

  private initializeExpressions(expressions: ExpressionModel[]) {
    for (let f of expressions) {
      if (!f.expressionText) continue;
      this.engine.registerFormula(f.uniqueId!, f.expressionText);
      this.humaizeExpression(f);

      const q = this.questions.find((x) => x.uniqueId == f.formQuestionUniqueId);
      if (q) {
        if (f.formExpressionType == FormExpressionTypeEnum.InsideForm) {
          switch (f.targetType) {
            case ExpressionTargetsEnum.Question:
              q.expressions[f.actionType!].push(f.expressionText);
              break;
            case ExpressionTargetsEnum.Answer:
              const opt = q.questionOptions.find((x) => x.uniqueIdPerForm == f.targetKey);
              if (opt) {
                opt.expressions[f.actionType!].push(f.expressionText);
              }

              break;
          }
        }
      }
    }
    console.log(expressions.map((m) => m.humanized));
  }

  private humaizeExpression(f: ExpressionModel) {
    const list = f.expressionText?.split(' ') ?? [];
    for (let i = 0; i < list.length; i++) {
      const r = this.stateMap.get(list[i]);
      list[i] = r ?? list[i];
    }
    f.humanized = list.join(' ');
  }
}
