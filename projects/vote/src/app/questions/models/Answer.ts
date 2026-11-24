import { computed, inject, signal } from '@angular/core';
import { ExpressionActionsEnum, GetQuestionOptionDto } from '@service-proxies/models';
import { VoteService } from '../services/vote.service';
import { FilteredExpression } from './FilteredExpression';

export class AnswerModel extends GetQuestionOptionDto {
  originalTitle?: string;
  disabled?: boolean;
  // matrix text box
  answerDescription?: string;
  // sku question total
  total?: number;
  fullQuota?: boolean;
  /** ترتیب لود پرسش های اولویت دار */
  orderAnswer?: number;

  /** درصد باقی مانده در سهمیه */
  remainedPercent!: number | undefined;
  remainedCount!: number | undefined;

  /**
   * uniqueIdPerForm without dash
   * - used in formula
   */
  fid: string;

  expressions = new FilteredExpression();

  canShow = true;
  constructor(data?: AnswerModel) {
    super();
    if (data) {
      for (let property in data) {
        if (data.hasOwnProperty(property)) {
          (this as any)[property] = (data as any)[property];
        }
      }
    }

    this.rowNumber ??= 0;
    this.fid = this.uniqueIdPerForm?.replace(/-/g, '') ?? '';
  }
}
