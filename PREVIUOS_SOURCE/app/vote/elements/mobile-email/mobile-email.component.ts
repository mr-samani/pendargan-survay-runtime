import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { CustomFormValidators } from '@core/custom-validator/form-validation';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { AppConsts } from '@core/app-consts';
import { VoterAnswerDetailValidationTypeEnum } from '@core/models/backend-dto/VoterAnswerDetailValidationTypeEnum';
import { ValidateVoterAnswerDetailDataInputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataInputDto';
import { ValidateVoterAnswerDetailDataOutputDto } from '@core/models/backend-dto/ValidateVoterAnswerDetailDataOutputDto';
import { SendCodeValidateVoterAnswerDetailOutputDto } from '@core/models/backend-dto/SendCodeValidateVoterAnswerDetailOutputDto';
import { SendCodeValidateVoterAnswerDetailDataInputDto } from '@core/models/backend-dto/SendCodeValidateVoterAnswerDetailDataInputDto';
import { finalize } from 'rxjs/operators';
import { convertSecondstoTime } from '@app/vote/helpers/time-string';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { setInterval, clearInterval } from 'worker-timers';

@Component({
  standalone: false,
  selector: 'mobile-email',
  templateUrl: './mobile-email.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MobileEmailComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => MobileEmailComponent),
      multi: true,
    },
  ],
})
export class MobileEmailComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  _disabled = false;
  @Input() set disabled(val: boolean) {
    this._disabled = val;
    if (this.myControl) {
      if (this._disabled) {
        this.myControl.disable();
      } else {
        this.myControl.enable();
      }
    }
  }
  isSendingCode = false;
  showConfirmCode = false;
  timerCounter = 120;
  timerCounterString = '';
  resendTimerInterval: any;

  confirmationCode = '';
  isChecking = false;

  isValid = false;
  constructor(
    injector: Injector,
    private customValidators: CustomFormValidators,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.init();
  }

  init(): void {
    let validations: any[] = [];
    if (this.item.isRequired) {
      validations.push(Validators.required);
    }

    if (this.item.questionType == FormQuestionTypesEnum.Mobile) {
      validations.push(this.customValidators.checkMobileNumber);
    }
    if (this.item.questionType == FormQuestionTypesEnum.Email) {
      validations.push(this.customValidators.checkEmail);
    }

    // Validation
    if (this.myControl) {
      this.myControl.setValidators(validations);
      this.myControl.updateValueAndValidity();
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    if (this.item.hasVerification && !this.isValid && this.myControl.value) {
      return { notVerfied: true };
    }
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }
  writeValue(value: any): void {
    this.myControl.setValue(value);
  }

  /*---------------verification-------------------------*/
  sendVerificationCode() {
    if (!this.myControl.value || this.myControl.invalid) {
      if (this.item.questionType == FormQuestionTypesEnum.Mobile) {
        this.notify.warning(this.translateService.instant('RequireMobileNumber'));
      } else {
        this.notify.warning(this.translateService.instant('RequireEmail'));
      }
      return;
    }
    this.isSendingCode = true;
    this.myControl.disable();
    const input: SendCodeValidateVoterAnswerDetailDataInputDto = {
      formQuestionUniqueId: this.item.uniqueId,
      formReserveGuid: this.vote.formGuid,
      validationKey: this.myControl.value,
      validationType:
        this.item.questionType == FormQuestionTypesEnum.Mobile
          ? VoterAnswerDetailValidationTypeEnum.ConfirmMobile
          : VoterAnswerDetailValidationTypeEnum.ConfirmEmail,
    };
    this.dataService
      .post<SendCodeValidateVoterAnswerDetailOutputDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.sendCodeValidateVoterAnswerDetail,
        input,
      )
      .pipe(finalize(() => (this.isSendingCode = false)))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.showConfirmCode = true;
            this.timerCounter = response.result.expirationTimeSecond;
            this.startTimer();
          } else {
            const msg = response?.error?.message;
            this.alert.show({
              html: '<pre>' + (msg ?? this.translateService.instant('AnErrorOccurredOnTheServer')) + '</pre>',
              confirmButtonText: this.translateService.instant('Ok'),
            });
          }
        },
        error: (er) => {
          this.handleApiError(er, false);
        },
      });
  }

  checkCode() {
    if (this.isValid) {
      return;
    }
    if (!this.confirmationCode || !this.myControl.value) {
      this.notify.warning(this.translateService.instant('EnterYourSmsCode'));
      return;
    }
    this.isChecking = true;
    const input: ValidateVoterAnswerDetailDataInputDto = {
      code: this.confirmationCode,
      formQuestionUniqueId: this.item.uniqueId,
      formReserveGuid: this.vote.formGuid,
      validationKey: this.myControl.value,
      validationType:
        this.item.questionType == FormQuestionTypesEnum.Mobile
          ? VoterAnswerDetailValidationTypeEnum.ConfirmMobile
          : VoterAnswerDetailValidationTypeEnum.ConfirmEmail,
    };
    this.dataService
      .post<ValidateVoterAnswerDetailDataOutputDto>(
        AppConsts.apiBaseUrl + AppConsts.serverApis.validateVoterAnswerDetailData,
        input,
      )
      .pipe(finalize(() => (this.isChecking = false)))
      .subscribe({
        next: (response) => {
          this.isChecking = false;
          this.isValid = response.result.validate;
          if (this.isValid) {
            this.item.validationKey = this.confirmationCode;
            this.item.validationGuid = response.result.validateGuid;
            this.myControl.disable();
            this.showConfirmCode = false;
            if (this.resendTimerInterval) {
              clearInterval(this.resendTimerInterval);
            }
            this.setChanged();
          } else {
            this.notify.error(this.translateService.instant('ConfirmationCodeIsInvalid'));
          }
        },
        error: (er: any) => {
          this.handleApiError(er, false);
        },
      });
  }

  /**
   * تایمر برای ارسال مجدد کد تائید
   */
  startTimer(): void {
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }
    this.resendTimerInterval = setInterval(() => {
      this.timerCounter--;
      this.timerCounterString = convertSecondstoTime(this.timerCounter);
      if (this.timerCounter <= 0) {
        clearInterval(this.resendTimerInterval);
        this.timerCounter = 0;
      }
    }, 1000);
  }

  setChanged() {
    if (this._disabled) {
      return;
    }
    if (this.myControl.invalid || (this.item.hasVerification && !this.isValid)) {
      this._onChange(null);
      return;
    }
    this.item.answer = this.myControl.value;
    this.logicService.changeAnswer(this.item);
    this._onChange(this.myControl.value);
  }

  editTextBox() {
    this.isValid = false;
    this.showConfirmCode = false;
    this.confirmationCode = '';
    this.myControl.enable();
  }
  clear() {
    if (this._disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}
