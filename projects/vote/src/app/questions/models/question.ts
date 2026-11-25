import {
  ExpressionActionsEnum,
  FormQuestionTypesEnum,
  GetFormQuestionQuestionOptionDto,
} from '@service-proxies/models';
import { AnswerModel } from './Answer';
import { computed, inject, signal, type Type } from '@angular/core';
import { ArraySortPipe } from '@vote/pipes/array-sort.pipe';
import { ArrayRandomizePipe } from '@vote/pipes/randomize.pipe';
import { validationAdditionalSettings } from '@vote/utils/additional-settings-validate';
import { DeclareQuestion } from '../definitions';
import { FilteredExpression } from './FilteredExpression';
import type { VoteService } from '../services/vote.service';

export class QuestionModel extends GetFormQuestionQuestionOptionDto {
  vote!: VoteService;
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

  expressions = new FilteredExpression();
  // TODO: change to signal
  showDescription = false;
  descriptionAnswer = '';

  /** Runtime-evaluated filters kept outside the API DTO and answer value. */
  fieldValueFilter?: string;
  secondaryFilterValue?: string;
  secondaryFieldValueFilter?: string;
  loading = signal(false);
  saveSuccess = signal<boolean | undefined>(undefined);
  invalid = signal<boolean>(false);

  /** Runtime overrides are separate from immutable API settings and answers. */
  readonly runtimePaymentAmount = signal<number | undefined>(undefined);
  readonly runtimeSecondaryFieldValueFilter = signal<string | undefined>(undefined);
  readonly runtimeEffectRevision = signal(0);

  readonly effectivePaymentAmount = computed(() => {
    const override = this.runtimePaymentAmount();
    if (override !== undefined) return override;
    const configured = (this.settings as Record<string, unknown> | null | undefined)?.['amount'];
    if (typeof configured === 'number') return configured;
    if (typeof configured === 'string' && configured.trim() !== '') {
      const parsed = Number(configured);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  });

  readonly effectiveSecondaryFieldValueFilter = computed(() =>
    this.runtimeSecondaryFieldValueFilter() ??
    this.secondaryFieldValueFilter ??
    this.secondaryFilterValue ??
    '',
  );

  readonly effectiveFieldValueFilter = computed(() => this.fieldValueFilter ?? '');
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
      // this.answer = this.answer ? +this.answer : this.minimumAnswer;
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

  public canShow = computed(() => {
    const v = this.expressions[ExpressionActionsEnum.Show];
    const h = this.expressions[ExpressionActionsEnum.Hide];

    const show = v.length ? this.vote.engine.eval(v.join('&&'), this.vote.form) : true;
    const hide = h.length ? this.vote.engine.eval(h.join('&&'), this.vote.form) : false;

    this.checkOptionExpr();
    console.log(this.rowNumber, show && !hide, v);
    return show && !hide;
  });

  checkOptionExpr() {
    for (let opt of this.questionOptions) {
      const v = opt.expressions[ExpressionActionsEnum.Show];
      const h = opt.expressions[ExpressionActionsEnum.Hide];
      const s = opt.expressions[ExpressionActionsEnum.Select];
      const u = opt.expressions[ExpressionActionsEnum.UnSelect];

      //prettier-ignore
      const show = v.length ? this.vote.engine.evaluateExpression(v.join('&&'), this.vote.form) : true;
      //prettier-ignore
      const hide = h.length ? this.vote.engine.evaluateExpression(h.join('&&'), this.vote.form) : false;
      //prettier-ignore
      const select = s.length ? this.vote.engine.evaluateExpression(s.join('&&'), this.vote.form) : undefined;
      //prettier-ignore
      const unSelect = u.length ? this.vote.engine.evaluateExpression(u.join('&&'), this.vote.form) : undefined;

      opt.canShow = show && !hide;
    }
  }
}
