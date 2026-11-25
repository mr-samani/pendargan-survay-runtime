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

  /** Reactive bridge for Payment and dynamic-data renderers. */
  readonly runtimeEffectRevision = computed(() => this.question().runtimeEffectRevision());
  readonly effectivePaymentAmount = computed(() => this.question().effectivePaymentAmount());
  readonly effectiveSecondaryFieldValueFilter = computed(() =>
    this.question().effectiveSecondaryFieldValueFilter(),
  );
  readonly effectiveFieldValueFilter = computed(() =>
    this.question().effectiveFieldValueFilter(),
  );

  public get DescriptionValueTypeEnum(): typeof DescriptionValueTypeEnum {
    return DescriptionValueTypeEnum;
  }
  onChangeDescription() {}
  public clear() {}
}
