import { Component, Injector } from '@angular/core';
import { BaseComponent } from '@app/base.component';
import { AppConsts } from '@core/app-consts';
import { GetTransactionInfoInputDto, GetTransactionInfoOutputDto } from './model';
import { finalize } from 'rxjs';
import { PollPaymentTransactionStatusEnum } from '@app/vote/elements/payment/model';

@Component({
  standalone: false,
  selector: 'app-payment-result',
  templateUrl: './payment-result.component.html',
  styleUrl: './payment-result.component.scss',
})
export class PaymentResultComponent extends BaseComponent {
  transactionId: string;
  reservedPollGuid: string;
  linkIsNotValid = false;
  loading = false;

  info?: GetTransactionInfoOutputDto;

  constructor(injector: Injector) {
    super(injector);
    let language = this.route.snapshot.queryParams['language'] || 'fa-IR';
    this.languageService.setPageLanguageAndDirection(language);
    this.transactionId = this.route.snapshot.queryParams['transactionId'] || undefined;
    this.reservedPollGuid = this.route.snapshot.queryParams['reservedPollGuid'] || undefined;
    if (!this.transactionId || !this.reservedPollGuid) {
      this.linkIsNotValid = true;
    } else {
      this.getTransactionInfo();
    }
  }

  public get PollPaymentTransactionStatusEnum(): typeof PollPaymentTransactionStatusEnum {
    return PollPaymentTransactionStatusEnum;
  }

  getTransactionInfo() {
    this.loading = true;
    const input: GetTransactionInfoInputDto = {
      id: this.transactionId ?? undefined,
      reservedPollGuid: this.reservedPollGuid,
    };
    this.dataService
      .post<GetTransactionInfoOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getTransactionInfo, input)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.info = response.result;
        },
        error: (er) => {
          this.handleApiError(er, false);

          this.linkIsNotValid = true;
        },
      });
  }
}
