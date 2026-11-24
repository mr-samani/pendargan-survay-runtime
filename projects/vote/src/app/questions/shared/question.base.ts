import { Component, computed, inject, input } from '@angular/core';
import type { QuestionModel } from '../models/question';
import { VoteService } from '../services/vote.service';
import { DescriptionValueTypeEnum, ExpressionActionsEnum } from '@service-proxies/models';

@Component({
  template: ``,
})
export abstract class QuestionBase {
  readonly question = input.required<QuestionModel>();
  readonly disabled = input<boolean>(false);
  protected readonly vote = inject(VoteService);

  public canShow = computed(() => {
    const v = this.question().expressions[ExpressionActionsEnum.Show];
    const h = this.question().expressions[ExpressionActionsEnum.Hide];

    const show = v.length ? this.vote.engine.eval(v.join('&&'), this.vote.form) : true;
    const hide = h.length ? this.vote.engine.eval(h.join('&&'), this.vote.form) : false;

    this.checkOptionExpr();
    console.log(this.question().rowNumber, show && !hide);
    return show && !hide;
  });

  checkOptionExpr() {
    for (let opt of this.question().questionOptions) {
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

  public get DescriptionValueTypeEnum(): typeof DescriptionValueTypeEnum {
    return DescriptionValueTypeEnum;
  }
  onChangeDescription() {}
  public clear() {}
}
