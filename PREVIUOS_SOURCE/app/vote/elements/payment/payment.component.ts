import {
  AfterViewInit,
  Component,
  Injector,
  Input,
  OnInit,
  ViewEncapsulation,
  forwardRef,
  isDevMode,
} from '@angular/core';
import { QuestionModel } from '@core/models/QuestionModel';
import {
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  AbstractControl,
  ControlValueAccessor,
  ValidationErrors,
  Validator,
  Validators,
  NgForm,
} from '@angular/forms';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { AppConsts } from '@core/app-consts';
import { isValidGuid } from '@core/helper/guid';
import { Subscription, finalize } from 'rxjs';
import { VoterAnswerDetailValidationTypeEnum } from '@core/models/backend-dto/VoterAnswerDetailValidationTypeEnum';
import { ValidateVoterAnswerDetailDataInputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataInputDto';
import { ValidateVoterAnswerDetailDataOutputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataOutputDto';
import { FormQuestionTenantPaymentGatewayListDto } from '@core/models/backend-dto/FormQuestionTenantPaymentGatewayListDto';
import { SignalRService } from '@core/services/signalr.service';
import { HubConnection } from '@microsoft/signalr';
import {
  CancelPollPaymentTransactionInputDto,
  GetOrAddPollPaymentTransactionInputDto,
  PollPaymentTransactionOfFormQuestionDto,
  PollPaymentTransactionStatusEnum,
  SendChangePollPaymentTransactionStatusDto,
} from './model';
import { SaveVoteService } from '@app/vote/services/save-vote.service';
import { EventEnum } from '@core/models/enums';
import { GetTransactionInfoInputDto, GetTransactionInfoOutputDto } from '@app/payment-result/model';
import { convertSecondstoTime } from '@app/vote/helpers/time-string';
import { setInterval, clearInterval } from 'worker-timers';
import { TenantPaymentGatewayListModel } from '@core/models/TenantPaymentGatewayListModel';

@Component({
  standalone: false,
  selector: 'payment-question',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PaymentQuestionComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PaymentQuestionComponent),
      multi: true,
    },
  ],
  encapsulation: ViewEncapsulation.None,
})
export class PaymentQuestionComponent
  extends CustomControlBase
  implements ControlValueAccessor, OnInit, AfterViewInit, Validator
{
  @Input() questionForm!: NgForm;
  @Input() item!: QuestionModel;
  @Input() disabled = false;
  loadingPay = false;

  isChecking = false;
  isValid = false;
  checkingSubscription?: Subscription;

  connection?: HubConnection;
  transactionStatus?: PollPaymentTransactionStatusEnum;
  pollPaymentTransactionId?: string;
  isCanceling = false;
  trackingCode?: string;
  /** قبل از پرداخت باید پرسشنامه ذخیره شود
   * - وقتی فرم ذخیره می شود باید پرسش های قبلی غیر فعال شوند
   * - و اگر پرداخت خطا داد و دوباره روی پرداخت زد دیگر نباید فرمی که ذخیره شده را دوباره ذخیره کرد
   */
  partialDataIsSaved = false;

  timerCounter = 0;
  resendTimerInterval: any;
  timerCounterString = '';

  gatewayList: TenantPaymentGatewayListModel[] = [];
  constructor(
    injector: Injector,
    private signalRservice: SignalRService,
    private saveVoteService: SaveVoteService,
  ) {
    super(injector);
  }

  public get PollPaymentTransactionStatusEnum(): typeof PollPaymentTransactionStatusEnum {
    return PollPaymentTransactionStatusEnum;
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  ngOnInit(): void {
    const uri = AppConsts.remoteBaseUrl + '/signalr-Payment-Transaction?reservedPollGuid=' + this.vote.formGuid;
    this.signalRservice.init(uri, (connection: HubConnection | undefined) => {
      console.info('SignalR:', connection?.state);
      this.connection = connection;
      this.registerEvents();
    });

    let validators = [];
    if (this.item.isRequired) {
      validators.push(Validators.required);
    }
    this.myControl.setValidators(validators);
    this.myControl.updateValueAndValidity();

    this.gatewayList = this.item.formQuestionTenantPaymentGateways ?? [];
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value) == false && isValidGuid(value)) {
      this.myControl.setValue(value);
      this.isValid = true;
    } else {
      this.myControl.reset();
      this.isValid = false;
    }
  }

  ngAfterViewInit(): void {}

  /**
   * دریافت لینک پرداخت
   * @param gateway درگاه پرداخت
   */
  checkout(gateway: FormQuestionTenantPaymentGatewayListDto) {
    if (this.loadingPay) {
      return;
    }
    if (!this.item.settings || isNullOrEmpty(this.item.settings?.amount)) {
      this.notify.warning(this.translateService.instant('NotDefinedAmount'));
      return;
    }
    if (this.vote.isPreviewMode) {
      this.notify.info(this.translateService.instant('CanNotPayInPreviewMode'));
      return;
    }
    if (this.vote.questionList.filter((q) => q.invalid && q.rowNumber < this.item.rowNumber).length > 0) {
      this.notify.warning(this.translateService.instant('CompleteFormInformationCorrectly'));
      this.vote.showRequiredFormQuestionValidate = true;
      this.logicService.scrollToFirstInvalidControl();
      return;
    }

    this.setDisablePreviousQuestions();
    this.savePartial(gateway.tenantPaymentGatewayId, () => {
      this.loadingPay = true;
      const input: GetOrAddPollPaymentTransactionInputDto = {
        pollPaymentTransactionId: this.pollPaymentTransactionId,
        reservedPollGuid: this.vote.formGuid,
        formQuestionUniqueId: this.item.uniqueId,
        transactionAmount: +this.item.settings?.amount!,
        paymentGatewayId: gateway.tenantPaymentGatewayId,
        transactionDescription: this.item.description,
      };
      this.dataService
        .post<PollPaymentTransactionOfFormQuestionDto>(
          AppConsts.apiBaseUrl + AppConsts.serverApis.getOrAddPollPaymentTransaction,
          input,
        )
        .pipe(finalize(() => (this.loadingPay = false)))
        .subscribe({
          next: (response) => {
            const result = response.result;
            this.pollPaymentTransactionId = result.pollPaymentTransactionId;
            this.transactionStatus = result.transactionStatus;
            if (result.isSuccess) {
              this.notify.success(this.translateService.instant('MovingToPaymentPage'));
              if (result.pollPaymentTransactionExpireTimeSeconds) {
                this.timerCounter = result.pollPaymentTransactionExpireTimeSeconds;
                this.startTimer();
              }

              let newWin = window.open(result.targetUrl, '_blank');
              if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                this.alert
                  .show({
                    text: this.translateService.instant('ClickToEnterPaymentGateway'),
                    showCancelButton: false,
                    showConfirmButton: true,
                    confirmButtonText: this.translateService.instant('EnterTo{value}', { value: gateway.name }),
                  })
                  .then((res) => {
                    if (res.isConfirmed) {
                      window.open(result.targetUrl, '_blank');
                    }
                  });
              }
            } else {
              this.alert.show({
                text: result.message,
                showCancelButton: false,
                showConfirmButton: true,
                confirmButtonText: this.translateService.instant('Ok'),
              });
            }
          },
          error: (er) => {
            this.handleApiError(er, false);
          },
        });
    });
  }

  /**
   * ذخیره تکه ای- برای پرسش پرداخت باید اطلاعات فرم قبل از رفتن به صفحه پرداخت ذخیره شود
   */
  savePartial(tenantPaymentGatewayId: string, callback: Function) {
    app.event.off(EventEnum.SaveVoteData + this.item.uniqueId);
    app.event.off(EventEnum.SaveVoteDataOnError + this.item.uniqueId);

    if (this.partialDataIsSaved == true) {
      callback();
    } else {
      this.saveVoteService.submitForm(
        this.vote,
        this.questionForm,
        false,
        false,
        true,
        this.item.uniqueId,
        tenantPaymentGatewayId,
      );
      app.event.on(EventEnum.SaveVoteData + this.item.uniqueId, () => {
        this.partialDataIsSaved = true;
        callback();
      });

      app.event.on(EventEnum.SaveVoteDataOnError + this.item.uniqueId, () => {
        this.setEnablePreviousQuestions();
      });
    }
  }

  /**
   * بررسی وضعیت پرداخت
   * - معتبر بودن مبلغ پرداخت شده با تراکنش ایدی
   */
  validatePayment() {
    this.isChecking = true;
    const input: ValidateVoterAnswerDetailDataInputDto = {
      code: this.item.settings?.amount + '',
      formQuestionUniqueId: this.item.uniqueId,
      formReserveGuid: this.vote.formGuid,
      validationKey: this.pollPaymentTransactionId,
      validationType: VoterAnswerDetailValidationTypeEnum.ConfirmPayment,
    };
    this.checkingSubscription = this.dataService
      .post<ValidateVoterAnswerDetailDataOutputDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.validateVoterAnswerDetailData,
        input,
      )
      .pipe(finalize(() => (this.isChecking = false)))
      .subscribe({
        next: (response) => {
          this.isValid = response.result.validate;
          if (this.isValid) {
            this.item.validationKey = input.validationKey;
            this.myControl.setValue(response.result.validateGuid);
            this.setChanged();
            if (this.resendTimerInterval) {
              clearInterval(this.resendTimerInterval);
            }
          } else {
            this.notify.error(this.translateService.instant('InvalidTransactionWithAmount'));
            this.cancelCheck();
          }
        },
        error: (er) => {
          this.cancelCheck();
        },
      });
  }

  /**
   * دریافت وضعیت تراکنش
   * - هنگاهی که در وضعیت منظر پرداخت است و اگر سیگنال ار کار نمیکرد می تواند دکمه بررسی را بزند
   */
  getTransactionInfo() {
    if (!this.pollPaymentTransactionId) {
      return;
    }
    this.isChecking = true;
    const input: GetTransactionInfoInputDto = {
      id: this.pollPaymentTransactionId,
      reservedPollGuid: this.vote.formGuid,
    };
    this.dataService
      .post<GetTransactionInfoOutputDto>(AppConsts.apiBaseUrl + AppConsts.serverApis.getTransactionInfo, input)
      .pipe(finalize(() => (this.isChecking = false)))
      .subscribe({
        next: (response) => {
          this.transactionStatus = response.result.status;
          this.trackingCode = response.result.gatewayTrackingCode;
          if (
            (this.transactionStatus == PollPaymentTransactionStatusEnum.Paid ||
              this.transactionStatus == PollPaymentTransactionStatusEnum.Completed) &&
            this.resendTimerInterval
          ) {
            clearInterval(this.resendTimerInterval);
            this.validatePayment();
          } else {
            if (response.result.pollPaymentTransactionExpireTimeSeconds) {
              this.timerCounter = response.result.pollPaymentTransactionExpireTimeSeconds;
              this.startTimer();
            }
          }
        },
        error: (er) => {
          this.handleApiError(er, false);
        },
      });
  }

  /**
   * نا معتبر کردن پرسش
   */
  cancelCheck() {
    this.isChecking = false;
    this.isValid = false;
    this.myControl.reset();
    this.setChanged();
    if (this.checkingSubscription) {
      this.checkingSubscription.unsubscribe();
    }
  }

  setChanged() {
    this._onChange(this.myControl.value);
    this.logicService.changeAnswer(this.item);
  }

  /**
   * رویداد های سیگنال آر
   */
  registerEvents() {
    if (!this.connection) {
      return;
    }
    this.signalRservice.on(
      this.connection,
      'OnChangePollPaymentTransactionStatus',
      (data: SendChangePollPaymentTransactionStatusDto) => {
        this.OnChangePollPaymentTransactionStatus(data);
      },
    );
  }
  /**
   * رویداد تغییر وضعیت تراکنش در سیگنال آر
   */
  OnChangePollPaymentTransactionStatus(data: SendChangePollPaymentTransactionStatusDto) {
    if (isDevMode()) {
      console.log('SignalR-payment-qid=', this.item.uniqueId, data);
    }
    if (
      data &&
      data.reservedPollGuid == this.vote.formGuid &&
      this.pollPaymentTransactionId == data.pollPaymentTransactionId
    ) {
      this.transactionStatus = data.transactionStatus;
      if (
        this.transactionStatus == PollPaymentTransactionStatusEnum.Paid ||
        this.transactionStatus == PollPaymentTransactionStatusEnum.Completed
      ) {
        this.validatePayment();
      }
    }
  }

  /**
   * انصراف از پرداخت
   * - زمانی که منتظر پرداخت است
   * - با انصراف دوباره پرسش های قبلی فعال می شوند
   */
  cancelPayment() {
    if (!this.pollPaymentTransactionId) {
      return;
    }
    const input: CancelPollPaymentTransactionInputDto = {
      reservedPollGuid: this.vote.formGuid,
      pollPaymentTransactionId: this.pollPaymentTransactionId,
    };
    this.isCanceling = true;
    this.dataService
      .post<void>(AppConsts.apiBaseUrl + AppConsts.serverApis.cancelPollPaymentTransaction, input)
      .pipe(finalize(() => (this.isCanceling = false)))
      .subscribe({
        next: (response) => {
          this.notify.success(this.translateService.instant('CancelPaymentSuccessfully'));
          this.pollPaymentTransactionId = undefined;
          this.setEnablePreviousQuestions();
        },
        error: (er) => {
          this.handleApiError(er, false);
        },
      });
  }

  /**
   * با هر پرداخت پرسش های قبلی باید غیر فعال شوند
   */
  setDisablePreviousQuestions() {
    this.vote.disablePreviousQuestionRowNumber.update((list) => {
      if (list.findIndex((x) => x.questionUniqueId == this.item.uniqueId) == -1) {
        list.push({
          questionUniqueId: this.item.uniqueId,
          rowNumber: this.item.rowNumber,
        });
      }
      return [...list];
    });
  }

  setEnablePreviousQuestions() {
    this.partialDataIsSaved = false;
    this.vote.disablePreviousQuestionRowNumber.update((list) => {
      const findedIndex = list.findIndex((x) => x.questionUniqueId == this.item.uniqueId);
      if (findedIndex > -1) {
        list.splice(findedIndex, 1);
      }
      return [...list];
    });
  }

  startTimer() {
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }
    this.resendTimerInterval = setInterval(() => {
      this.timerCounter--;
      this.timerCounterString = convertSecondstoTime(this.timerCounter);
      if (this.timerCounter <= 0) {
        clearInterval(this.resendTimerInterval);
        this.timerCounter = 0;
        this.timerCounterString = '';
        if (!this.isValid) {
          this.cancelCheck();
          this.setEnablePreviousQuestions();
        }
      }
    }, 1000);
  }
}
