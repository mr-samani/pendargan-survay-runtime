import { Component, OnInit, Input, Injector } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { PollPaymentTransactionStatusEnum } from '@app/vote/elements/payment/model';

@Component({
  standalone: false,
  selector: 'view-payment',
  templateUrl: './payment.component.html',
})
export class ViewPaymentQuestionComponent implements OnInit {
  @Input() item!: FormQuestionAnswerDto;
  isValid = false;
  ngOnInit(): void {
    if (this.item && this.item.voterAnswerDetailDto && this.item.voterAnswerDetailDto.length > 0) {
      this.isValid = !isNullOrEmpty(this.item.voterAnswerDetailDto[0].validationGuid);
    }
  }

  public get PollPaymentTransactionStatusEnum(): typeof PollPaymentTransactionStatusEnum {
    return PollPaymentTransactionStatusEnum;
  }
}
