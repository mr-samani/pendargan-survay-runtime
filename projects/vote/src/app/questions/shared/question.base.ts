import { Component, computed, inject, input } from '@angular/core';
import type { QuestionModel } from '../models/question';
import { FormulaEngineService } from 'ngx-exp-parser';
import { VoteService } from '../services/vote.service';
import { DescriptionValueTypeEnum } from '@service-proxies/models';

@Component({
  template: ``,
})
export abstract class QuestionBase {
  protected readonly engine = inject(FormulaEngineService);
  readonly question = input.required<QuestionModel>();
  readonly disabled = input<boolean>(false);
  protected readonly vote = inject(VoteService);

  public canShow = computed(() => {
    if (!this.question().conditions.length) return true;
    const r = this.engine.eval(this.question().conditions.join('&&'), this.vote.form);
    console.log(r);
    return r;
  });

  public get DescriptionValueTypeEnum(): typeof DescriptionValueTypeEnum {
    return DescriptionValueTypeEnum;
  }
  onChangeDescription() {}
  public clear() {}
}
