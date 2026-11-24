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

  public get DescriptionValueTypeEnum(): typeof DescriptionValueTypeEnum {
    return DescriptionValueTypeEnum;
  }
  onChangeDescription() {}
  public clear() {}
}
